import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import jobs, remove_bg, vectorize, scrape
from services.queue_manager import queue_manager

os.makedirs("/tmp/pixelforge", exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    worker_task = asyncio.create_task(queue_manager.start_worker())
    yield
    queue_manager.stop_worker()
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="LAPIE Studio API",
    description="Self-hosted image processing — background removal & vectorization",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(remove_bg.router, prefix="/api", tags=["processing"])
app.include_router(vectorize.router, prefix="/api", tags=["processing"])
app.include_router(jobs.router, prefix="/api", tags=["jobs"])
app.include_router(scrape.router, prefix="/api", tags=["scrape"])


@app.get("/health", tags=["system"])
async def health():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "queue": {
            "pending": queue_manager.queue.qsize(),
            "total_jobs": len(queue_manager.jobs),
        },
    }
