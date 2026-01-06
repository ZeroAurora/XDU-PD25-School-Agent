from __future__ import annotations

from datetime import datetime
from typing import Any

from .llm import chat_completion_json


def _to_int_or_none(v: Any) -> int | None:
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return int(v)
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        # accept digits-only
        if s.isdigit():
            try:
                return int(s)
            except ValueError:
                return None
    return None


def parse_time_constraints(user_text: str, *, now: datetime) -> dict[str, int | None]:
    """Parse time constraints from a natural-language user query.

    Returns a dict with keys:
    - date_start/date_end: YYYYMMDD integer or None
    - time_start/time_end: HHMM integer or None

    This is best-effort: on errors, returns all None.
    """

    user_text = (user_text or "").strip()
    if not user_text:
        return {
            "date_start": None,
            "date_end": None,
            "time_start": None,
            "time_end": None,
        }

    system = (
        "你是一个时间范围信息抽取器。你的任务是从用户中文输入中抽取日期/时间限制，并输出严格 JSON。\n"
        "输出字段仅允许：date_start, date_end, time_start, time_end。\n"
        "- date_* 使用整数 YYYYMMDD，例如 20260106。\n"
        "- time_* 使用整数 HHMM，例如 930 表示 09:30，1900 表示 19:00。\n"
        "- 如果用户没有给出对应限制，请输出 null。\n"
        "- 需要解析相对时间（如 今天/明天/本周/下周/周五/今晚/下午 等），相对基准为给定的当前时间。\n"
        "- 如果只给出单日，date_start=date_end。\n"
        "- 如果只给出一个时间点（如 下午三点），优先填 time_start，time_end 为 null。\n"
        "- 不要输出任何额外字段，不要输出解释。"
    )

    # Note: keep a simple, unambiguous reference time for the model.
    ref = now.strftime("%Y-%m-%d %H:%M")
    weekday = ["一", "二", "三", "四", "五", "六", "日"][now.weekday()]
    ref += f"（星期{weekday}）"
    user = f"当前时间：{ref}\n用户输入：{user_text}"

    try:
        data = chat_completion_json(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ]
        )
    except Exception:
        data = {}

    date_start = _to_int_or_none((data or {}).get("date_start"))
    date_end = _to_int_or_none((data or {}).get("date_end"))
    time_start = _to_int_or_none((data or {}).get("time_start"))
    time_end = _to_int_or_none((data or {}).get("time_end"))

    # Basic sanity checks
    if time_start is not None and (time_start < 0 or time_start > 2359):
        time_start = None
    if time_end is not None and (time_end < 0 or time_end > 2359):
        time_end = None

    # Normalize inverted ranges
    if date_start is not None and date_end is not None and date_start > date_end:
        date_start, date_end = date_end, date_start

    if time_start is not None and time_end is not None and time_start > time_end:
        time_start, time_end = time_end, time_start

    return {
        "date_start": date_start,
        "date_end": date_end,
        "time_start": time_start,
        "time_end": time_end,
    }


def build_chroma_where_from_query(
    user_text: str,
    *,
    now: datetime,
) -> tuple[dict[str, Any] | None, dict[str, int | None]]:
    """Build a ChromaDB `where` filter from a user query.

    - Uses LLM extraction via `parse_time_constraints`.
    - Returns (where_filter_or_none, constraints_dict).
    - If no time constraints were found, returns (None, constraints).
    """

    constraints = parse_time_constraints(user_text, now=now)
    date_start = constraints.get("date_start")
    date_end = constraints.get("date_end")
    time_start = constraints.get("time_start")
    time_end = constraints.get("time_end")

    if not any(v is not None for v in (date_start, date_end, time_start, time_end)):
        return None, constraints

    where_terms: list[dict[str, Any]] = []

    if date_start is not None:
        where_terms.append({"date": {"$gte": int(date_start)}})
    if date_end is not None:
        where_terms.append({"date": {"$lte": int(date_end)}})

    # Overlap semantics for HHMM
    if time_start is not None:
        where_terms.append({"endTime": {"$gt": int(time_start)}})
    if time_end is not None:
        where_terms.append({"startTime": {"$lt": int(time_end)}})

    if not where_terms:
        return None, constraints
    if len(where_terms) == 1:
        return where_terms[0], constraints
    return {"$and": where_terms}, constraints
