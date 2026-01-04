import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseModel):
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "qwen3-max")

    embedding_api_key: str = os.getenv("EMBEDDING_API_KEY", "")
    embedding_base_url: str = os.getenv(
        "EMBEDDING_BASE_URL", "https://api.siliconflow.cn"
    )
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")

    chroma_dir: str = os.getenv("CHROMA_DIR", "./chroma_data")
    chroma_collection: str = os.getenv("CHROMA_COLLECTION", "campus_acts")


settings = Settings()
