from __future__ import annotations
from datetime import datetime
from .llm import chat_completion
from .retriever import ChromaRetriever

retriever = ChromaRetriever()


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


async def chat_once(user_msg: str, k: int = 5, extra_context: str = "") -> dict:
    if not user_msg:
        return {"reply": "请先输入你的问题。"}

    search_res = await retriever.query(user_msg, k=k)
    docs = search_res.get("documents", [[]])[0] if search_res else []  # pyright: ignore[reportOptionalSubscript]
    metas = search_res.get("metadatas", [[]])[0] if search_res else []  # pyright: ignore[reportOptionalSubscript]

    context_lines = []
    for i, (d, m) in enumerate(zip(docs, metas)):
        title = (m or {}).get("title") or (m or {}).get("name") or f"Doc{i + 1}"
        context_lines.append(f"[{i + 1}] {title}: {d}")

    context_block = "\n".join(context_lines)
    if extra_context:
        context_block += f"\n[EXTRA] {extra_context}"

    messages = [
        {"role": "system", "content": get_system_prompt()},
        {
            "role": "user",
            "content": f"用户问题：{user_msg}\n\n检索片段（最多{len(docs)}条）：\n{context_block}\n\n请基于片段作答；若片段不足，请明确说明假设。",
        },
    ]

    reply = chat_completion(messages)
    return {
        "k": k,
        "hits": len(docs),
        "reply": reply,
        "contexts": [{"text": d, "metadata": m} for d, m in zip(docs, metas)],
    }
