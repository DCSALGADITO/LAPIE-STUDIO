from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from models.job import JobType
from services.queue_manager import queue_manager
from services.potrace_service import process_vectorize

router = APIRouter()


@router.post("/vectorize")
async def vectorize_image(
    file: UploadFile = File(...),
    blacklevel: str = Form("0.5"),
    alphamax: str = Form("1.0"),
    opttolerance: str = Form("0.2"),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Un fichier image est requis (PNG recommandé pour la vectorisation)",
        )

    contents = await file.read()

    job = queue_manager.create_job(
        job_type=JobType.VECTORIZE,
        filename=file.filename or "image.png",
        file_size=len(contents),
        result_extension="svg",
    )
    
    job.vectorize_params = {
        "blacklevel": blacklevel,
        "alphamax": alphamax,
        "opttolerance": opttolerance,
    }

    output_path = f"/tmp/pixelforge/{job.id}_result.svg"
    original_path = f"/tmp/pixelforge/{job.id}_original"

    with open(original_path, "wb") as fout:
        fout.write(contents)

    await queue_manager.enqueue(job, process_vectorize, contents, output_path)

    return {
        "job_id": job.id,
        "status": job.status,
        "message": "Job créé, en attente de traitement...",
    }
