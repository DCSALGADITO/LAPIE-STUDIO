from fastapi import APIRouter, File, HTTPException, UploadFile

from models.job import JobType
from services.queue_manager import queue_manager
from services.rembg_service import process_remove_bg

router = APIRouter()


@router.post("/remove-bg")
async def remove_background(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Un fichier image est requis (JPEG, PNG, WEBP, GIF...)",
        )

    contents = await file.read()

    job = queue_manager.create_job(
        job_type=JobType.REMOVE_BG,
        filename=file.filename or "image.png",
        file_size=len(contents),
        result_extension="png",
    )

    output_path = f"/tmp/pixelforge/{job.id}_result.png"
    original_path = f"/tmp/pixelforge/{job.id}_original"

    with open(original_path, "wb") as fout:
        fout.write(contents)

    await queue_manager.enqueue(job, process_remove_bg, contents, output_path)

    return {
        "job_id": job.id,
        "status": job.status,
        "message": "Job créé, en attente de traitement...",
    }
