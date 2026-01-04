from datetime import datetime
import uuid

from fastapi import APIRouter, Body, HTTPException, Query
from ..services.retriever import get_retriever
from pydantic import BaseModel
from typing import Optional

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
    date: str
    startTime: str
    endTime: str
    location: Optional[str] = None
    type: EventType
    description: Optional[str] = None


class CreateEventRequest(BaseModel):
    title: str
    date: str
    startTime: str
    endTime: str
    location: Optional[str] = None
    type: EventType
    description: Optional[str] = None


class UpdateEventRequest(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    location: Optional[str] = None
    type: Optional[EventType] = None
    description: Optional[str] = None


def _event_to_text(event: ScheduleEvent) -> str:
    """Convert event to searchable text for RAG."""
    parts = [
        f"{event.date} {event.startTime}-{event.endTime}",
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
        "type": event.type,
        "description": event.description,
        "source": "schedule",
    }


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
            try:
                event = ScheduleEvent(
                    id=event_id,
                    title=metadata.get("title", ""),
                    date=metadata.get("date", ""),
                    startTime=metadata.get("startTime", ""),
                    endTime=metadata.get("endTime", ""),
                    location=metadata.get("location"),
                    type=EventType(metadata.get("type", "announcement")),
                    description=metadata.get("description"),
                )
                events.append(event)
            except (ValueError, TypeError):
                # Skip events with invalid metadata
                continue
    
    return events


@router.get("/events")
async def list_events(date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)")):
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
            try:
                return ScheduleEvent(
                    id=event_id,
                    title=metadata.get("title", ""),
                    date=metadata.get("date", ""),
                    startTime=metadata.get("startTime", ""),
                    endTime=metadata.get("endTime", ""),
                    location=metadata.get("location"),
                    type=EventType(metadata.get("type", "announcement")),
                    description=metadata.get("description"),
                )
            except (ValueError, TypeError):
                return None
    
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
    current_date = now.strftime("%Y年%m月%d日")
    weekday = ["一", "二", "三", "四", "五", "六", "日"][now.weekday()]
    month = now.month
    if 3 <= month <= 5:
        season = "春季"
    elif 6 <= month <= 8:
        season = "夏季"
    elif 9 <= month <= 11:
        season = "秋季"
    else:
        season = "冬季"
    query = (
        f"当前时间：{current_date} 星期{weekday} {now.strftime('%H:%M')}（{season}），查询与当前时间最接近的活动。用户查询：{q}。"
    )
    retriever = get_retriever()
    results = await retriever.query(query, k=k)

    # Extract event IDs and fetch full event data from ChromaDB
    events = []
    for r in results:
        doc_id = r.get("id", "")
        if doc_id.startswith("schedule:"):
            event_id = doc_id.replace("schedule:", "")
            metadata = r.get("metadata", {})
            try:
                event = ScheduleEvent(
                    id=event_id,
                    title=metadata.get("title", ""),
                    date=metadata.get("date", ""),
                    startTime=metadata.get("startTime", ""),
                    endTime=metadata.get("endTime", ""),
                    location=metadata.get("location"),
                    type=EventType(metadata.get("type", "announcement")),
                    description=metadata.get("description"),
                )
                events.append(event)
            except (ValueError, TypeError):
                continue

    return {"events": events, "count": len(events)}
