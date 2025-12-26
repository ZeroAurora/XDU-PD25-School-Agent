from fastapi import APIRouter
from ..services.embedding import Embedder
from ..services.retriever import get_retriever, reset_retriever
from ..config import settings
import re

router = APIRouter()

_retriever_cache = None
_emb_cache = None


def get_retr():
    return get_retriever()


def get_emb():
    global _emb_cache
    if _emb_cache is None:
        _emb_cache = Embedder()
    return _emb_cache


async def current_settings():
    return {
        "chroma_dir": settings.chroma_dir,
        "col_bge": settings.chroma_collection,
        "embedding_base_url": settings.embedding_base_url,
        "embedding_model": settings.embedding_model,
    }


@router.get("/emb")
async def emb_dim():
    e = get_emb()
    vec = await e.embed(["hello"])
    return {"embed_dim": len(vec[0])}


@router.get("/ping_chroma")
async def ping_chroma():
    r = get_retr()
    e = get_emb()
    model_vec = await e.embed(["probe"])
    model_dim = len(model_vec[0])
    try:
        res = await r.query("probe", k=1)
        return {"status": "ok", "model_dim": model_dim, "result_keys": list(res.keys())}
    except Exception as ex:
        msg = str(ex)
        m = re.search(r"dimension of (\d+), got (\d+)", msg)
        expected_dim = int(m.group(1)) if m else None
        got_dim = int(m.group(2)) if m else None
        return {
            "status": "error",
            "model_dim": model_dim,
            "error": msg,
            "collection_expected_dim": expected_dim,
            "query_dim": got_dim,
        }


@router.delete("/reset")
async def reset_collection():
    r = get_retr()
    name = settings.chroma_collection
    try:
        r.client.delete_collection(name)
        r.collection = r.client.get_or_create_collection(name)
        reset_retriever()
        return {"deleted": name, "ok": True}
    except Exception as ex:
        return {"deleted": name, "ok": False, "error": str(ex)}


@router.post("/cleanup")
async def cleanup_resources():
    """清理embedding资源"""
    try:
        r = get_retr()
        await r.cleanup()
        return {"status": "ok", "message": "资源清理完成"}
    except Exception as ex:
        return {"status": "error", "error": str(ex)}
