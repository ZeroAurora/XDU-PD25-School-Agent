#!/usr/bin/env python3
"""
RAG API测试脚本
使用sample_data中的数据测试RAG接口功能
"""

import json
import asyncio
import httpx
from pathlib import Path


async def load_sample_data():
    """加载示例数据"""
    sample_data_path = Path(__file__).parent / "sample_data" / "sample_events.json"
    with open(sample_data_path, "r", encoding="utf-8") as f:
        return json.load(f)


async def test_ingest(base_url: str, sample_data: list):
    """测试数据导入接口"""
    print("\n=== 测试数据导入 (POST /api/rag/ingest) ===")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{base_url}/api/rag/ingest", json=sample_data, timeout=30.0
            )

            if response.status_code == 200:
                result = response.json()
                print("✅ 数据导入成功")
                print(f"   导入数量: {result.get('count', 0)}")
                return True
            else:
                print("❌ 数据导入失败")
                print(f"   状态码: {response.status_code}")
                print(f"   响应内容: {response.text}")
                return False

        except Exception as e:
            print(f"❌ 请求异常: {str(e)}")
            return False


async def test_search(base_url: str, queries: list):
    """测试搜索接口"""
    print("\n=== 测试搜索功能 (GET /api/rag/search) ===")

    async with httpx.AsyncClient() as client:
        for i, query in enumerate(queries, 1):
            print(f"\n查询 {i}: {query}")

            try:
                response = await client.get(
                    f"{base_url}/api/rag/search",
                    params={"q": query, "k": 3},
                    timeout=30.0,
                )

                if response.status_code == 200:
                    result = response.json()
                    print("✅ 搜索成功")

                    # 打印搜索结果
                    # API返回格式: {ids: [[]], documents: [[]], metadatas: [[]], distances: [[]]}
                    if (
                        "documents" in result
                        and result["documents"]
                        and len(result["documents"][0]) > 0
                    ):
                        documents = result["documents"][0]
                        distances = (
                            result["distances"][0] if "distances" in result else []
                        )
                        metadatas = (
                            result["metadatas"][0] if "metadatas" in result else []
                        )

                        for j, (doc, dist, meta) in enumerate(
                            zip(documents, distances, metadatas), 1
                        ):
                            text = doc[:100] + "..." if len(doc) > 100 else doc
                            distance = f"{dist:.4f}" if dist is not None else "N/A"
                            title = (
                                meta.get("title", "无标题")
                                if isinstance(meta, dict)
                                else "无标题"
                            )
                            print(f"   结果 {j}: {title}")
                            print(f"   内容: {text}")
                            print(f"   相似度距离: {distance}")
                            print()
                    else:
                        print("   未找到相关结果")

                else:
                    print("❌ 搜索失败")
                    print(f"   状态码: {response.status_code}")
                    print(f"   响应内容: {response.text}")

            except Exception as e:
                print(f"❌ 请求异常: {str(e)}")


async def test_health_check(base_url: str):
    """测试健康检查接口"""
    print("\n=== 测试健康检查 (GET /api/health/ping) ===")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{base_url}/api/health/ping", timeout=10.0)

            if response.status_code == 200:
                result = response.json()
                print("✅ 服务状态正常")
                print(f"   状态: {result.get('ok', 'unknown')}")
                return True
            else:
                print("❌ 服务状态异常")
                print(f"   状态码: {response.status_code}")
                return False

        except Exception as e:
            print(f"❌ 请求异常: {str(e)}")
            return False


async def main():
    """主测试函数"""
    print("🎯 RAG API 测试脚本")
    print("=" * 50)

    # 配置
    base_url = "http://localhost:8000"

    # 加载示例数据
    print("📁 加载示例数据...")
    sample_data = await load_sample_data()
    print(f"   加载了 {len(sample_data)} 条数据")

    # 显示加载的数据
    for i, item in enumerate(sample_data, 1):
        print(f"   数据 {i}: {item['text'][:50]}...")

    # 测试健康检查
    health_ok = await test_health_check(base_url)
    if not health_ok:
        print("\n⚠️  服务未启动，请先运行: uvicorn app.main:app --reload")
        return

    # 测试数据导入
    ingest_ok = await test_ingest(base_url, sample_data)
    if not ingest_ok:
        print("\n⚠️  数据导入失败，跳过搜索测试")
        return

    # 定义测试查询
    test_queries = [
        "AI学术沙龙",
        "图书馆报告厅",
        "创业俱乐部",
        "开源之夜",
        "计算机学院活动",
    ]

    # 测试搜索功能
    await test_search(base_url, test_queries)

    print("\n🎉 测试完成！")


if __name__ == "__main__":
    asyncio.run(main())
