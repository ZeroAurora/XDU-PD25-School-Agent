from __future__ import annotations
import chromadb
from chromadb.config import Settings as ChromaSettings
from ..config import settings
from .embedding import Embedder
from chromadb.errors import InvalidArgumentError


class ChromaRetriever:
    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=settings.chroma_dir,
            settings=ChromaSettings(allow_reset=True),
        )
        self._embedder = None
        self.collection = self.client.get_or_create_collection(
            settings.chroma_collection
        )

    def _get_embedder(self):
        if self._embedder is None:
            self._embedder = Embedder()
        return self._embedder

    async def upsert(self, docs, metadatas, ids):
        # 1) 计算嵌入 - 使用异步版本
        embs = await self._get_embedder().embed(docs)
        embs = [self._ensure_pylist(e) for e in embs]
        # 2) 写入时带上 embeddings
        self.collection.upsert(
            documents=docs, metadatas=metadatas, ids=ids, embeddings=embs
        )

    def _ensure_pylist(self, v):
        # numpy -> python list，防止 JSON 序列化报错
        try:
            return v.tolist()
        except Exception:
            return v

    async def query(self, query_text: str, k: int = 5):
        embs_array = await self._get_embedder().embed([query_text])
        embs = self._ensure_pylist(embs_array[0])
        try:
            raw_result: dict = dict(self.collection.query(
                query_embeddings=[embs],
                n_results=k,
                include=[
                    "documents",
                    "metadatas",
                    "distances",
                    "uris",
                ],  # 不要 embeddings
            ))
            return self._transform_to_row_format(raw_result)
        except InvalidArgumentError as e:
            # 遇到维度不匹配：删除集合并重建，然后重试一次（空集合会返回空结果，不再报 384）
            msg = str(e)
            if "dimension" in msg or "embedding with dimension" in msg:
                try:
                    self.client.delete_collection(settings.chroma_collection)
                except Exception:
                    pass
                self.collection = self.client.get_or_create_collection(
                    settings.chroma_collection
                )
                embs_array = await self._get_embedder().embed([query_text])
                embs = self._ensure_pylist(embs_array[0])
                raw_result: dict = dict(self.collection.query(
                    query_embeddings=[embs],
                    n_results=k,
                    include=["documents", "metadatas", "distances", "uris"],
                ))
                return self._transform_to_row_format(raw_result)
            raise

    def _transform_to_row_format(self, query_result: dict) -> list[dict]:
        """Transform column-first ChromaDB result to row-first list of objects."""
        # Extract arrays from nested structure (ChromaDB wraps in outer list)
        ids = query_result.get("ids", [[]])[0] if query_result.get("ids") else []
        docs = query_result.get("documents", [[]])[0] if query_result.get("documents") else []
        metas = query_result.get("metadatas", [[]])[0] if query_result.get("metadatas") else []
        dists = query_result.get("distances", [[]])[0] if query_result.get("distances") else []
        
        # Handle empty results
        if not ids:
            return []
        
        # Build row-first list of objects
        return [
            {
                "id": id_,
                "document": doc,
                "metadata": meta or {},
                "distance": dist
            }
            for id_, doc, meta, dist in zip(ids, docs, metas, dists)
        ]

    async def delete(self, ids: list[str]):
        """Delete documents by IDs."""
        self.collection.delete(ids=ids)

    async def cleanup(self):
        """清理资源"""
        if self._embedder is not None:
            await self._embedder.cleanup()
            self._embedder = None


# ---- 在文件底部新增：单例 + 重置 ----
_singleton = None


def get_retriever() -> ChromaRetriever:
    global _singleton
    if _singleton is None:
        _singleton = ChromaRetriever()
    return _singleton


def reset_retriever():
    global _singleton
    _singleton = None
