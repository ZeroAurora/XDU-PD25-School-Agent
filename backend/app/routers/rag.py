from fastapi import APIRouter, Body, Query
from ..services.retriever import get_retriever
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class IngestItem(BaseModel):
    text: str
    id: str
    metadata: Optional[dict] = None


@router.post("/ingest")
async def ingest(items: list[IngestItem] = Body(...)):
    retriever = get_retriever()
    count = 0
    for it in items:
        await retriever.upsert([it.text], [it.metadata or {}], [it.id])
        count += 1
    return {"ok": True, "count": count}


@router.get("/search")
async def search(q: str = Query(...), k: int = 5):
    retriever = get_retriever()
    return await retriever.query(q, k=k)
