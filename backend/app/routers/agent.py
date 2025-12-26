from fastapi import APIRouter, Body
from ..services.agent_core import chat_once
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class ChatPayload(BaseModel):
    message: str
    k: Optional[int] = 5
    extra_context: Optional[str] = ""


@router.post("/chat")
async def chat(payload: ChatPayload = Body(...)):
    return await chat_once(
        payload.message,
        k=payload.k if payload.k is not None else 5,
        extra_context=payload.extra_context
        if payload.extra_context is not None
        else "",
    )
