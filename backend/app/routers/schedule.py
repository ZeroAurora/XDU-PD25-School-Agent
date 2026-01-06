from datetime import datetime
import uuid
from functools import partial

from fastapi import APIRouter, Body, HTTPException, Query
from ..services.retriever import get_retriever
from ..services.time_constraints import build_chroma_where_from_query
from pydantic import BaseModel
from typing import Optional
from anyio import to_thread

from enum import Enum


class EventType(str, Enum):
    COURSE = "course"
    ACTIVITY = "activity"
    EXAM = "exam"
    MEETING = "meeting"
    ANNOUNCEMENT = "announcement"


router = APIRouter()


class ScheduleEvent(BaseModel):
    id: str
    title: str
    date: int
    startTime: int
    endTime: int
    location: Optional[str] = None
    type: EventType
    description: Optional[str] = None


class CreateEventRequest(BaseModel):
    title: str
    date: int
    startTime: int
    endTime: int
    location: Optional[str] = None
    type: EventType
    description: Optional[str] = None


class UpdateEventRequest(BaseModel):
    title: Optional[str] = None
    date: Optional[int] = None
    startTime: Optional[int] = None
    endTime: Optional[int] = None
    location: Optional[str] = None
    type: Optional[EventType] = None
    description: Optional[str] = None


def _event_to_text(event: ScheduleEvent) -> str:
    """Convert event to searchable text for RAG."""
    st = f"{event.startTime:04d}"
    et = f"{event.endTime:04d}"
    parts = [
        f"{event.date} {st}-{et}",
        f"【{event.type.value}】{event.title}",
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
        "type": event.type.value,
        "description": event.description,
        "source": "schedule",
    }


def _event_from_metadata(event_id: str, metadata: dict) -> ScheduleEvent | None:
    try:
        date = (metadata or {}).get("date")
        start_time = (metadata or {}).get("startTime")
        end_time = (metadata or {}).get("endTime")
        if date is None or start_time is None or end_time is None:
            return None
        return ScheduleEvent(
            id=event_id,
            title=(metadata or {}).get("title", ""),
            date=date,
            startTime=start_time,
            endTime=end_time,
            location=(metadata or {}).get("location"),
            type=EventType((metadata or {}).get("type", "announcement")),
            description=(metadata or {}).get("description"),
        )
    except (ValueError, TypeError):
        return None


async def _ingest_to_rag(event: ScheduleEvent):
    """Ingest event into RAG system."""
    retriever = get_retriever()
    text = _event_to_text(event)
    metadata = _event_to_metadata(event)
    await retriever.upsert(
        docs=[text],
        metadatas=[metadata],
        ids=[f"schedule:{event.id}"],
    )


async def _remove_from_rag(event_id: str):
    """Remove event from RAG system."""
    retriever = get_retriever()
    await retriever.delete(ids=[f"schedule:{event_id}"])


@router.post("/events", response_model=ScheduleEvent)
async def create_event(request: CreateEventRequest = Body(...)):
    """Create a new schedule event and ingest into RAG."""
    event_id = str(uuid.uuid4())
    event = ScheduleEvent(
        id=event_id,
        title=request.title,
        date=request.date,
        startTime=request.startTime,
        endTime=request.endTime,
        location=request.location,
        type=request.type,
        description=request.description,
    )

    await _ingest_to_rag(event)

    return event


async def _get_all_events_from_rag() -> list[ScheduleEvent]:
    """Get all schedule events from ChromaDB."""
    retriever = get_retriever()
    results = await retriever.get_all()
    
    events = []
    for r in results:
        doc_id = r.get("id", "")
        if doc_id.startswith("schedule:"):
            metadata = r.get("metadata", {})
            # Reconstruct event from metadata
            event_id = doc_id.replace("schedule:", "")
            event = _event_from_metadata(event_id, metadata)
            if event is not None:
                events.append(event)
    
    return events


@router.get("/events")
async def list_events(date: Optional[int] = Query(None, description="Filter by date (YYYYMMDD)")):
    """List all events from ChromaDB, optionally filtered by date."""
    events = await _get_all_events_from_rag()
    if date:
        events = [e for e in events if e.date == date]
    return {"events": events, "count": len(events)}


async def _get_event_from_rag(event_id: str) -> Optional[ScheduleEvent]:
    """Get a single event from ChromaDB by ID."""
    retriever = get_retriever()
    results = await retriever.get_all()
    
    for r in results:
        doc_id = r.get("id", "")
        if doc_id == f"schedule:{event_id}":
            metadata = r.get("metadata", {})
            return _event_from_metadata(event_id, metadata)
    
    return None


@router.get("/events/{event_id}", response_model=ScheduleEvent)
async def get_event(event_id: str):
    """Get a single event by ID from ChromaDB."""
    event = await _get_event_from_rag(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.put("/events/{event_id}", response_model=ScheduleEvent)
async def update_event(event_id: str, request: UpdateEventRequest = Body(...)):
    """Update an event and re-ingest into RAG."""
    old_event = await _get_event_from_rag(event_id)
    if old_event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    updated_event = ScheduleEvent(
        id=event_id,
        title=request.title or old_event.title,
        date=request.date or old_event.date,
        startTime=request.startTime or old_event.startTime,
        endTime=request.endTime or old_event.endTime,
        location=request.location or old_event.location,
        type=request.type or old_event.type,
        description=request.description or old_event.description,
    )

    await _ingest_to_rag(updated_event)

    return updated_event


@router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    """Delete an event from RAG."""
    event = await _get_event_from_rag(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    await _remove_from_rag(event_id)

    return {"ok": True, "deleted": event_id}


@router.get("/search")
async def search_events(q: str = Query(..., description="Search query"), k: int = 5):
    """Search schedule events using RAG."""
    now = datetime.now()

    where_filter, _constraints = await to_thread.run_sync(
        partial(build_chroma_where_from_query, q, now=now)
    )

    retriever = get_retriever()
    results = await retriever.query(q, k=k, where=where_filter)

    # Extract event IDs and fetch full event data from ChromaDB
    events = []
    for r in results:
        doc_id = r.get("id", "")
        if doc_id.startswith("schedule:"):
            event_id = doc_id.replace("schedule:", "")
            metadata = r.get("metadata", {})
            event = _event_from_metadata(event_id, metadata)
            if event is not None:
                events.append(event)

    return {"events": events, "count": len(events)}
