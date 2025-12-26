from fastapi import FastAPI
from .routers import health, rag, agent, debug

app = FastAPI(title="McroDesign Backend", version="0.2.0")
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(rag.router, prefix="/api/rag", tags=["rag"])
app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
app.include_router(debug.router, prefix="/api/debug", tags=["debug"])
