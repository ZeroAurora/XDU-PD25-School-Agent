from fastapi import APIRouter, Body, Query, HTTPException
from ..services.embedding import Embedder
from ..services.retriever import get_retriever, reset_retriever
from ..config import settings
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import re
import os
import json
import uuid
from pathlib import Path
from enum import Enum

router = APIRouter()


class IngestItem(BaseModel):
    text: str
    id: str
    metadata: Optional[dict] = None


class BatchIngestRequest(BaseModel):
    documents: List[Dict[str, Any]]
    options: Optional[Dict[str, bool]] = None


class DocumentInfo(BaseModel):
    id: str
    text: str
    metadata: Dict[str, Any]
    distance: Optional[float] = None


class EventType(str, Enum):
    COURSE = "course"
    ACTIVITY = "activity"
    EXAM = "exam"
    MEETING = "meeting"
    ANNOUNCEMENT = "announcement"


class ScheduleEvent(BaseModel):
    id: str
    title: str
    date: int
    startTime: int
    endTime: int
    location: Optional[str] = None
    type: EventType
    description: Optional[str] = None


class StatsResponse(BaseModel):
    document_count: int
    storage_size_bytes: int
    storage_size_formatted: str
    embedding_dimension: int
    collection_name: str
    chroma_status: str
    health: str
    last_updated: str


_emb_cache = None


def get_retr():
    return get_retriever()


def get_emb():
    global _emb_cache
    if _emb_cache is None:
        _emb_cache = Embedder()
    return _emb_cache


# Schedule event helper functions for debug endpoints
SAMPLE_EVENTS_FILE = Path(__file__).parent.parent.parent / "sample_data" / "sample_campus_events.json"


def _event_to_text(event: ScheduleEvent) -> str:
    """Convert event to searchable text for RAG."""
    st = f"{event.startTime:04d}"
    et = f"{event.endTime:04d}"
    parts = [
        f"{event.date} {st}-{et}",
        f"【{event.type}】{event.title}",
    ]
    if event.location:
        parts.append(f"地点：{event.location}")
    if event.description:
        parts.append(event.description)
    return " | ".join(parts)


def _event_to_metadata(event: ScheduleEvent) -> dict:
    """Convert event to metadata for RAG."""
    return {
        "title": event.title,
        "date": event.date,
        "startTime": event.startTime,
        "endTime": event.endTime,
        "location": event.location,
        "type": event.type.value if hasattr(event.type, "value") else str(event.type),
        "description": event.description,
        "source": "schedule",
    }


async def _ingest_to_rag(event: ScheduleEvent):
    """Ingest event into RAG system."""
    retriever = get_retr()
    text = _event_to_text(event)
    metadata = _event_to_metadata(event)
    await retriever.upsert(
        docs=[text],
        metadatas=[metadata],
        ids=[f"schedule:{event.id}"],
    )


def _load_sample_events_from_json() -> list[dict]:
    """Load sample events from JSON file."""
    if SAMPLE_EVENTS_FILE.exists():
        with open(SAMPLE_EVENTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def _create_event_from_dict(data: dict) -> ScheduleEvent:
    """Create a ScheduleEvent from a dictionary (for JSON data)."""
    return ScheduleEvent(
        id=data.get("id", str(uuid.uuid4())),
        title=data["title"],
        date=data["date"],
        startTime=data["startTime"],
        endTime=data["endTime"],
        location=data.get("location"),
        type=data["type"],
        description=data.get("description"),
    )


async def current_settings():
    return {
        "chroma_dir": settings.chroma_dir,
        "col_bge": settings.chroma_collection,
        "embedding_base_url": settings.embedding_base_url,
        "embedding_model": settings.embedding_model,
    }


@router.get("/emb")
async def emb_dim():
    e = get_emb()
    vec = await e.embed(["hello"])
    return {"embed_dim": len(vec[0])}


@router.delete("/reset")
async def reset_collection():
    r = get_retr()
    name = settings.chroma_collection
    try:
        r.client.delete_collection(name)
        r.collection = r.client.get_or_create_collection(name)
        reset_retriever()
        return {"deleted": name, "ok": True}
    except Exception as ex:
        return {"deleted": name, "ok": False, "error": str(ex)}


@router.post("/cleanup")
async def cleanup_resources():
    """清理embedding资源"""
    try:
        r = get_retr()
        await r.cleanup()
        return {"status": "ok", "message": "资源清理完成"}
    except Exception as ex:
        return {"status": "error", "error": str(ex)}

@router.post("/rag/ingest")
async def rag_ingest(items: list[IngestItem] = Body(...)):
    """Ingest documents into RAG vector store."""
    retriever = get_retr()
    count = 0
    for it in items:
        await retriever.upsert(docs=[it.text], metadatas=[it.metadata or {}], ids=[it.id])
        count += 1
    return {"ok": True, "count": count}


@router.get("/rag/search")
async def rag_search(q: str = Query(...), k: int = 5):
    """Search RAG vector store."""
    retriever = get_retr()
    return await retriever.query(q, k=k)


def format_bytes(bytes_size: int) -> str:
    """Format bytes to human readable string."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024:
            return f"{bytes_size:.2f} {unit}"
        bytes_size //= 1024
    return f"{bytes_size:.2f} TB"


def get_chroma_storage_size() -> int:
    """Get approximate storage size of ChromaDB data."""
    chroma_dir = settings.chroma_dir
    total_size = 0
    if os.path.exists(chroma_dir):
        for dirpath, dirnames, filenames in os.walk(chroma_dir):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                try:
                    total_size += os.path.getsize(filepath)
                except OSError:
                    pass
    return total_size


@router.get("/stats")
async def get_stats() -> StatsResponse:
    """Get collection statistics."""
    r = get_retr()
    e = get_emb()
    
    # Get document count
    try:
        count = r.collection.count()
    except Exception:
        count = 0
    
    # Get storage size
    storage_size = get_chroma_storage_size()
    
    # Get embedding dimension
    model_vec = await e.embed(["probe"])
    model_dim = len(model_vec[0])
    
    # Determine health status
    health = "healthy" if count > 0 else "degraded"
    
    return StatsResponse(
        document_count=count,
        storage_size_bytes=storage_size,
        storage_size_formatted=format_bytes(storage_size),
        embedding_dimension=model_dim,
        collection_name=settings.chroma_collection,
        chroma_status="ok",
        health=health,
        last_updated=__import__("datetime").datetime.now().isoformat(),
    )


@router.get("/ping_chroma")
async def ping_chroma():
    """Enhanced ChromaDB status check with more details."""
    r = get_retr()
    e = get_emb()
    model_vec = await e.embed(["probe"])
    model_dim = len(model_vec[0])
    
    # Get storage size
    storage_size = get_chroma_storage_size()
    
    try:
        res = await r.query("probe", k=1)
        # Get document count
        try:
            doc_count = r.collection.count()
        except Exception:
            doc_count = 0
        
        return {
            "status": "ok",
            "model_dim": model_dim,
            "result_count": doc_count,
            "result_keys": list(res[0].keys()) if res else [],
            "storage_size": storage_size,
            "storage_size_formatted": format_bytes(storage_size),
            "health": "healthy" if doc_count > 0 else "degraded",
            "collection_name": settings.chroma_collection,
        }
    except Exception as ex:
        msg = str(ex)
        m = re.search(r"dimension of (\d+), got (\d+)", msg)
        expected_dim = int(m.group(1)) if m else None
        got_dim = int(m.group(2)) if m else None
        return {
            "status": "error",
            "model_dim": model_dim,
            "error": msg,
            "collection_expected_dim": expected_dim,
            "query_dim": got_dim,
            "storage_size": storage_size,
            "health": "down",
        }


@router.get("/documents")
async def list_documents(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0)
):
    """List all documents in the collection with pagination."""
    r = get_retr()
    try:
        # Get all documents by searching with an empty query
        results = await r.query("", k=limit + offset)
        
        # Skip to offset and limit results
        docs = results[offset:offset + limit]
        
        return {
            "total": r.collection.count(),
            "limit": limit,
            "offset": offset,
            "documents": [
                {
                    "id": doc.get("id", ""),
                    "text": doc.get("document", ""),
                    "metadata": doc.get("metadata", {}),
                    "distance": doc.get("distance"),
                }
                for doc in docs
            ]
        }
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    """Get a single document by ID."""
    r = get_retr()
    try:
        results = await r.query("", k=100)
        for doc in results:
            if doc.get("id") == doc_id:
                return {
                    "id": doc.get("id", ""),
                    "text": doc.get("document", ""),
                    "metadata": doc.get("metadata", {}),
                    "distance": doc.get("distance"),
                }
        raise HTTPException(status_code=404, detail="Document not found")
    except HTTPException:
        raise
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a single document by ID."""
    r = get_retr()
    try:
        r.collection.delete(ids=[doc_id])
        return {"deleted": doc_id, "ok": True}
    except Exception as ex:
        return {"deleted": doc_id, "ok": False, "error": str(ex)}


@router.delete("/documents")
async def delete_all_documents():
    """Delete all documents from the collection (keep collection)."""
    r = get_retr()
    try:
        # Get all document IDs
        results = await r.get_all()
        ids = [doc.get("id") for doc in results if doc.get("id")]
        
        # Filter out None values and ensure all IDs are strings
        ids = [str(i) for i in ids if i is not None]
        
        if ids:
            r.collection.delete(ids=ids)
        
        return {"deleted_count": len(ids), "ok": True}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}


@router.get("/export")
async def export_collection():
    """Export all documents from collection as JSON."""
    r = get_retr()
    try:
        results = await r.get_all()
        documents = [
            {
                "id": doc.get("id", ""),
                "text": doc.get("document", ""),
                "metadata": doc.get("metadata", {}),
            }
            for doc in results
        ]
        return {
            "collection": settings.chroma_collection,
            "count": len(documents),
            "documents": documents,
        }
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))


@router.post("/batch_ingest")
async def batch_ingest(request: BatchIngestRequest):
    """Batch ingest documents from JSON."""
    retriever = get_retr()
    docs = request.documents
    options = request.options or {}
    
    skip_duplicates = options.get("skip_duplicates", False)
    
    count = 0
    skipped = 0
    
    for doc in docs:
        doc_id = doc.get("id", f"doc-{count}")
        text = doc.get("text", doc.get("document", ""))
        metadata = doc.get("metadata", {})
        
        if skip_duplicates:
            try:
                existing = await retriever.query(text, k=1)
                if existing and len(existing) > 0:
                    skipped += 1
                    continue
            except Exception:
                pass
        
        await retriever.upsert(docs=[text], metadatas=[metadata], ids=[doc_id])
        count += 1
    
    return {
        "ok": True,
        "imported": count,
        "skipped": skipped,
        "total": len(docs)
    }


@router.post("/schedule/seed")
async def seed_schedule_events():
    """Seed schedule events from JSON file for testing."""
    sample_data = _load_sample_events_from_json()
    if not sample_data:
        return {"ok": False, "message": "No sample events found in JSON file"}

    sample_events = [_create_event_from_dict(data) for data in sample_data]

    for event in sample_events:
        await _ingest_to_rag(event)

    return {"ok": True, "count": len(sample_events)}


@router.delete("/schedule/clear")
async def clear_schedule_events():
    """Clear all schedule events from RAG (for testing)."""
    retriever = get_retr()
    
    # Get all schedule documents
    try:
        results = await retriever.get_all()
        schedule_ids = []
        
        for doc in results:
            doc_id = doc.get("id", "")
            metadata = doc.get("metadata", {})
            
            # Check if this is a schedule event
            if doc_id.startswith("schedule:") or metadata.get("source") == "schedule":
                schedule_ids.append(doc_id)
        
        # Delete all schedule documents
        if schedule_ids:
            retriever.collection.delete(ids=schedule_ids)
        
        return {"ok": True, "deleted": len(schedule_ids)}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}

