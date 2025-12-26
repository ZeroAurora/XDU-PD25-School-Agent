from __future__ import annotations

from ..config import settings
from openai import OpenAI


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
