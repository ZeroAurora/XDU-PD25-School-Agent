from __future__ import annotations
from typing import List, Optional
from ..config import settings
import numpy as np
import httpx
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential


class EmbeddingAPIError(Exception):
    pass


class Embedder:
    """API-based embedder with retry logic and caching."""

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._model_dim: Optional[int] = None
        self._api_key_checked = False

    async def _get_client(self) -> httpx.AsyncClient:
        """获取或创建HTTP客户端"""
        if not self._api_key_checked:
            if not settings.embedding_api_key:
                raise ValueError("EMBEDDING_API_KEY 未配置，请在环境变量中设置")
            self._api_key_checked = True

        if self._client is None:
            headers = {
                "Authorization": f"Bearer {settings.embedding_api_key}",
                "Content-Type": "application/json",
            }
            self._client = httpx.AsyncClient(
                base_url=settings.embedding_base_url, headers=headers, timeout=30.0
            )
        return self._client

    async def _close_client(self):
        """关闭HTTP客户端"""
        if self._client:
            await self._client.aclose()
            self._client = None

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True,
    )
    async def _call_embedding_api(self, texts: List[str]) -> List[List[float]]:
        client = await self._get_client()

        payload = {
            "model": settings.embedding_model,
            "input": texts,
            "encoding_format": "float",
        }

        try:
            response = await client.post("/v1/embeddings", json=payload)
            response.raise_for_status()

            data = response.json()
            if "data" not in data:
                raise EmbeddingAPIError(f"API响应格式错误: {data}")

            embeddings = []
            for item in data["data"]:
                if "embedding" in item:
                    embeddings.append(item["embedding"])
                else:
                    raise EmbeddingAPIError(f"响应中缺少embedding: {item}")

            return embeddings

        except httpx.HTTPStatusError as e:
            error_msg = f"API请求失败: {e.response.status_code} - {e.response.text}"
            raise EmbeddingAPIError(error_msg)
        except httpx.RequestError as e:
            error_msg = f"网络请求错误: {str(e)}"
            raise EmbeddingAPIError(error_msg)
        except Exception as e:
            error_msg = f"未知错误: {str(e)}"
            raise EmbeddingAPIError(error_msg)

    async def _get_model_dimension(self) -> int:
        """获取模型embedding维度"""
        if self._model_dim is None:
            # 使用一个简单的测试文本获取维度
            test_embeddings = await self._call_embedding_api(["dimension test"])
            self._model_dim = len(test_embeddings[0])
        return self._model_dim

    async def embed(self, texts: List[str]) -> np.ndarray:
        """
        批量生成文本的embedding向量

        Args:
            texts: 待编码的文本列表

        Returns:
            numpy.ndarray: embedding向量数组，shape为(len(texts), embedding_dim)
        """
        if not texts:
            return np.array([], dtype="float32")

        # 过滤空字符串
        filtered_texts = [text.strip() for text in texts if text.strip()]
        if not filtered_texts:
            return np.array(
                [[0.0] * await self._get_model_dimension()] * len(texts),
                dtype="float32",
            )

        try:
            embeddings = await self._call_embedding_api(filtered_texts)

            # 如果有过滤的文本，需要映射回原始长度
            if len(filtered_texts) != len(texts):
                result_embeddings = []
                filter_idx = 0
                for original_text in texts:
                    if original_text.strip():
                        result_embeddings.append(embeddings[filter_idx])
                        filter_idx += 1
                    else:
                        # 空字符串使用零向量
                        result_embeddings.append(
                            [0.0] * await self._get_model_dimension()
                        )
                embeddings = result_embeddings

            return np.array(embeddings, dtype="float32")

        except EmbeddingAPIError as e:
            # 如果API调用失败，返回零向量以避免系统崩溃
            print(f"Embedding API调用失败: {e}")
            dim = await self._get_model_dimension()
            zero_vectors = [[0.0] * dim] * len(texts)
            return np.array(zero_vectors, dtype="float32")

    def embed_sync(self, texts: List[str]) -> np.ndarray:
        """同步版本的embedding（用于兼容现有代码）"""
        try:
            # 创建新的事件循环来运行异步代码
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(self.embed(texts))
            finally:
                loop.close()
        except Exception as e:
            print(f"同步embedding失败: {e}")
            # 返回零向量
            dim = 1024  # 默认维度
            return np.array([[0.0] * dim] * len(texts), dtype="float32")

    async def cleanup(self):
        """清理资源"""
        await self._close_client()

    def __del__(self):
        """析构函数，确保资源清理"""
        # 注意：在生产环境中，应该正确地清理异步资源
        # 但在析构函数中无法直接调用异步函数
        if hasattr(self, "_client") and self._client:
            # 这里只是记录日志，实际的资源清理应该在应用关闭时手动调用cleanup()
            try:
                loop = asyncio.get_event_loop()
                if not loop.is_closed():
                    # 尝试在现有循环中关闭客户端（如果可能）
                    asyncio.create_task(self._close_client())
            except Exception:
                pass
