from fastapi import APIRouter, Body
from fastapi.responses import StreamingResponse
from ..services.agent_core import prepare_chat_messages
from ..services.llm import chat_completion, chat_completion_stream
from pydantic import BaseModel
from typing import Optional
import json

router = APIRouter()


class ChatPayload(BaseModel):
    message: str
    k: Optional[int] = 5
    extra_context: Optional[str] = ""
    stream: Optional[bool] = False


@router.post("/chat")
async def chat(payload: ChatPayload = Body(...)):
    user_msg = payload.message
    k = payload.k if payload.k is not None else 5
    extra_context = payload.extra_context if payload.extra_context is not None else ""
    stream = bool(payload.stream)

    prepared = await prepare_chat_messages(user_msg, k=k, extra_context=extra_context)
    if not prepared:
        # Keep legacy behavior for empty messages
        return {"reply": "请先输入你的问题。", "k": k, "hits": 0, "contexts": []}

    messages, contexts, hits = prepared

    if not stream:
        reply = chat_completion(messages)
        return {"k": k, "hits": hits, "reply": reply, "contexts": contexts}

    def sse_pack(obj: dict) -> bytes:
        return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n".encode("utf-8")

    def event_stream():
        yield sse_pack({"type": "meta", "k": k, "hits": hits})
        try:
            for delta in chat_completion_stream(messages):
                if delta:
                    yield sse_pack({"type": "delta", "delta": delta})
            yield sse_pack({"type": "done", "contexts": contexts})
        except Exception as e:  # noqa: BLE001
            yield sse_pack({"type": "error", "message": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
