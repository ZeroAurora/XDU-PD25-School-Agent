from __future__ import annotations

from ..config import settings
from openai import OpenAI
import json
from typing import Any


def get_client() -> OpenAI:
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required")
    base_url = settings.openai_base_url or None
    return OpenAI(api_key=settings.openai_api_key, base_url=base_url)


def chat_completion(messages: list[dict], model: str | None = None) -> str:
    client = get_client()
    m = model or settings.openai_model
    resp = client.chat.completions.create(model=m, messages=messages)  # type: ignore
    return resp.choices[0].message.content or ""


def chat_completion_json(messages: list[dict], model: str | None = None) -> dict[str, Any]:
    """Return a parsed JSON object using OpenAI JSON mode.

    Best-effort: returns {} if parsing fails.
    """

    client = get_client()
    m = model or settings.openai_model
    resp = client.chat.completions.create(
        model=m,
        messages=messages, # type: ignore
        response_format={"type": "json_object"},
    )
    content = resp.choices[0].message.content or "{}"
    try:
        obj = json.loads(content)
        return obj if isinstance(obj, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def chat_completion_stream(messages: list[dict], model: str | None = None):
    """Yield incremental text deltas from the model.

    This is a synchronous generator; Starlette will iterate it in a threadpool
    when used with StreamingResponse.
    """

    client = get_client()
    m = model or settings.openai_model
    stream = client.chat.completions.create(
        model=m,
        messages=messages, # type: ignore
        stream=True,
    )

    for chunk in stream:
        try:
            delta = chunk.choices[0].delta.content
        except Exception:  # noqa: BLE001
            delta = None
        if delta:
            yield delta
