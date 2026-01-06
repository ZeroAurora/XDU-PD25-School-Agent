from __future__ import annotations
from datetime import datetime
from .retriever import ChromaRetriever
from .time_constraints import build_chroma_where_from_query
from functools import partial
from anyio import to_thread

from typing import Literal, TypedDict

retriever = ChromaRetriever()


class ChatTurn(TypedDict):
    role: Literal["user", "assistant"]
    content: str


def get_system_prompt() -> str:
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
    return (
        f"你是校园活动助手，擅长汇总与推荐活动。当前时间：{current_date} 星期{weekday} {now.strftime('%H:%M')}（{season}）。"
        "请根据当前时间提供时效性准确的回答。"
        "你的知识库包含校园活动信息，回答时请："
        "1. 优先推荐正在报名或即将开始的活动"
        "2. 过期活动应明确提示已结束"
        "3. 以要点形式简洁回答，并标注活动来源"
        "4. 如信息不确定，请明确说明"
    )


def _normalize_history(history: list[dict] | None) -> list[ChatTurn]:
    if not history:
        return []
    out: list[ChatTurn] = []
    for t in history:
        role = t.get("role")
        content = (t.get("content") or "").strip()
        if role not in ("user", "assistant"):
            continue
        if not content:
            continue
        out.append({"role": role, "content": content})
    return out


def _trim_history(
    history: list[ChatTurn],
    *,
    max_messages: int = 20,
    max_chars: int = 8000,
) -> list[ChatTurn]:
    # Keep the most recent context within rough size limits.
    if not history:
        return []
    tail = history[-max_messages:]
    total = 0
    kept_rev: list[ChatTurn] = []
    for t in reversed(tail):
        total += len(t.get("content", ""))
        kept_rev.append(t)
        if total >= max_chars:
            break
    return list(reversed(kept_rev))


def _last_user_message(history: list[ChatTurn]) -> str | None:
    for t in reversed(history):
        if t.get("role") == "user" and (t.get("content") or "").strip():
            return (t.get("content") or "").strip()
    return None


async def prepare_chat_messages_from_history(
    history: list[dict] | None,
    *,
    k: int = 5,
    extra_context: str = "",
) -> tuple[list[dict], list[dict], int] | None:
    normalized = _normalize_history(history)
    normalized = _trim_history(normalized)

    query_text = _last_user_message(normalized)
    if not query_text:
        return None

    # Time constraint extraction (OpenAI JSON mode) + metadata filtering
    now = datetime.now()
    where, _constraints = await to_thread.run_sync(
        partial(build_chroma_where_from_query, query_text, now=now)
    )

    search_res = await retriever.query(query_text, k=k, where=where)
    docs = [r.get("document", "") for r in search_res] if search_res else []
    metas = [r.get("metadata", {}) for r in search_res] if search_res else []

    # If no results, do a fallback search without time constraints
    if not docs:
        search_res = await retriever.query(query_text, k=k)
        docs = [r.get("document", "") for r in search_res] if search_res else []
        metas = [r.get("metadata", {}) for r in search_res] if search_res else []

    context_lines: list[str] = []
    for i, (d, m) in enumerate(zip(docs, metas)):
        title = (m or {}).get("title") or (m or {}).get("name") or f"Doc{i + 1}"
        context_lines.append(f"[{i + 1}] {title}: {d}")

    context_block = "\n".join(context_lines).strip()
    if extra_context:
        context_block = (
            f"{context_block}\n[EXTRA] {extra_context}" if context_block else f"[EXTRA] {extra_context}"
        )

    rag_msg = (
        "以下是从校园活动知识库中检索到的相关信息，请结合这些信息回答用户的问题。\n"
        + (context_block if context_block else "（无检索结果）")
    )

    messages: list[dict] = [
        {"role": "system", "content": get_system_prompt() + "\n" + rag_msg},
    ]

    # Append conversation history (user/assistant only)
    messages.extend({"role": t["role"], "content": t["content"]} for t in normalized)

    contexts = [{"text": d, "metadata": m} for d, m in zip(docs, metas)]
    return messages, contexts, len(docs)
