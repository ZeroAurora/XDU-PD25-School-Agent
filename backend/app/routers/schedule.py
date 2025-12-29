import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Body, HTTPException, Query
from ..services.retriever import get_retriever
from pydantic import BaseModel
from typing import Optional

from enum import Enum
from typing import Optional, Literal


class EventType(str, Enum):
    COURSE = "course"
    ACTIVITY = "activity"
    EXAM = "exam"
    MEETING = "meeting"
    ANNOUNCEMENT = "announcement"


router = APIRouter()


# Path to sample events data
SAMPLE_EVENTS_FILE = Path(__file__).parent.parent.parent / "sample_data" / "sample_campus_events.json"


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


# In-memory storage for schedule events (could be replaced with a database)
_events: dict[str, ScheduleEvent] = {}


def _event_to_text(event: ScheduleEvent) -> str:
    """Convert event to searchable text for RAG."""
    parts = [
        f"{event.date} {event.startTime}-{event.endTime}",
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

    _events[event_id] = event
    await _ingest_to_rag(event)

    return event


@router.get("/events")
async def list_events(date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)")):
    """List all events, optionally filtered by date."""
    events = list(_events.values())
    if date:
        events = [e for e in events if e.date == date]
    return {"events": events, "count": len(events)}


@router.get("/events/{event_id}", response_model=ScheduleEvent)
async def get_event(event_id: str):
    """Get a single event by ID."""
    if event_id not in _events:
        raise HTTPException(status_code=404, detail="Event not found")
    return _events[event_id]


@router.put("/events/{event_id}", response_model=ScheduleEvent)
async def update_event(event_id: str, request: UpdateEventRequest = Body(...)):
    """Update an event and re-ingest into RAG."""
    if event_id not in _events:
        raise HTTPException(status_code=404, detail="Event not found")

    old_event = _events[event_id]
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

    _events[event_id] = updated_event
    await _ingest_to_rag(updated_event)

    return updated_event


@router.delete("/events/{event_id}")
async def delete_event(event_id: str):
    """Delete an event and remove from RAG."""
    if event_id not in _events:
        raise HTTPException(status_code=404, detail="Event not found")

    del _events[event_id]
    await _remove_from_rag(event_id)

    return {"ok": True, "deleted": event_id}


@router.get("/search")
async def search_events(q: str = Query(..., description="Search query"), k: int = 5):
    """Search schedule events using RAG."""
    retriever = get_retriever()
    results = await retriever.query(q, k=k)

    # Extract event IDs and fetch full event data
    events = []
    for r in results:
        event_id = r.get("id", "").replace("schedule:", "")
        if event_id and event_id in _events:
            events.append(_events[event_id])

    return {"events": events, "count": len(events)}


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


@router.post("/seed")
async def seed_sample_events():
    """Seed sample events from JSON file for testing."""
    sample_data = _load_sample_events_from_json()
    if not sample_data:
        return {"ok": False, "message": "No sample events found in JSON file"}

    sample_events = [_create_event_from_dict(data) for data in sample_data]

    for event in sample_events:
        _events[event.id] = event
        await _ingest_to_rag(event)

    return {"ok": True, "count": len(sample_events)}


@router.delete("/clear")
async def clear_all_events():
    """Clear all events (for testing)."""
    global _events
    event_ids = list(_events.keys())
    _events = {}

    # Batch delete from RAG
    if event_ids:
        retriever = get_retriever()
        rag_ids = [f"schedule:{eid}" for eid in event_ids]
        await retriever.delete(ids=rag_ids)

    return {"ok": True, "deleted": len(event_ids)}
