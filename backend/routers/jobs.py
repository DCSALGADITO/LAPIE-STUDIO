import asyncio
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from models.job import JobStatus
from services.queue_manager import queue_manager

router = APIRouter()


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = queue_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' introuvable")
    return job


@router.get("/jobs/{job_id}/stream")
async def stream_job_progress(job_id: str):
    """Server-Sent Events endpoint — sends job status updates every 300ms."""
    job = queue_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' introuvable")

    async def generator():
        while True:
            current_job = queue_manager.get_job(job_id)
            if not current_job:
                yield {"event": "error", "data": '{"error":"Job introuvable"}'}
                break

            yield {"event": "update", "data": current_job.model_dump_json()}

            if current_job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                break

            await asyncio.sleep(0.3)

    return EventSourceResponse(generator())


@router.get("/jobs/{job_id}/result")
async def download_result(job_id: str):
    """Download the processed result file (PNG or SVG)."""
    job = queue_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' introuvable")
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=425, detail="Job non encore terminé")
    if not job.result_path or not os.path.exists(job.result_path):
        raise HTTPException(status_code=404, detail="Fichier résultat introuvable")

    ext = job.result_extension
    media_type = "image/svg+xml" if ext == "svg" else "image/png"
    stem = job.original_filename.rsplit(".", 1)[0] if "." in job.original_filename else job.original_filename
    filename = f"{stem}_{job.type.value}.{ext}"

    return FileResponse(
        path=job.result_path,
        media_type=media_type,
        filename=filename,
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/jobs/{job_id}/original")
async def get_original(job_id: str):
    """Serve the original uploaded image for before/after comparison."""
    for ext in ("", ".png", ".jpg", ".jpeg", ".webp", ".gif"):
        path = f"/tmp/pixelforge/{job_id}_original{ext}"
        if os.path.exists(path):
            return FileResponse(path=path, headers={"Cache-Control": "no-cache"})
    raise HTTPException(status_code=404, detail="Fichier original introuvable")
