import asyncio
import os
from models.job import Job, JobStatus


async def process_remove_bg(job: Job, input_bytes: bytes, output_path: str) -> None:
    from services.queue_manager import queue_manager

    queue_manager.update_job(job.id, progress=10, message="Analyse de l'image...")
    await asyncio.sleep(0.1)

    input_path = f"/tmp/pixelforge/{job.id}_in.png"
    with open(input_path, "wb") as f:
        f.write(input_bytes)

    # Detect image type (photo vs logo/illustration) to pick the best model
    is_photo = await _detect_is_photo(input_bytes)

    if is_photo:
        # isnet-general-use is optimized for complex photographic subjects
        model_name = os.environ.get("REMBG_MODEL_PHOTO", "isnet-general-use")
        queue_manager.update_job(job.id, progress=25, message=f"Photo détectée — modèle ISNet (haute précision)...")
    else:
        # u2net is better for logos, illustrations, product shots
        model_name = os.environ.get("REMBG_MODEL_LOGO", "u2net")
        queue_manager.update_job(job.id, progress=25, message=f"Illustration/logo détecté — modèle U2Net...")

    await asyncio.sleep(0.1)

    queue_manager.update_job(job.id, progress=40, message="Segmentation IA en cours (alpha matting activé)...")

    # Run rembg with alpha matting for smoother edges
    cmd = [
        "rembg", "i",
        "-m", model_name,
        "-a",                          # Enable alpha matting
        "-ae", "15",                   # Alpha matting erosion size
        input_path,
        output_path,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    queue_manager.update_job(job.id, progress=65, message="Calcul des masques de transparence...")
    stdout, stderr = await proc.communicate()

    # Cleanup input
    try:
        os.unlink(input_path)
    except Exception:
        pass

    if proc.returncode != 0:
        error_msg = stderr.decode('utf-8', errors='ignore').strip()
        out_msg = stdout.decode('utf-8', errors='ignore').strip()
        all_lines = (error_msg + "\n" + out_msg).split("\n")
        meaningful = [l.strip() for l in all_lines if l.strip()]
        last_error = meaningful[-1] if meaningful else "Erreur inconnue"
        raise Exception(last_error)

    # Post-process: smooth edges
    queue_manager.update_job(job.id, progress=85, message="Lissage des bords et optimisation finale...")
    await asyncio.get_event_loop().run_in_executor(None, _smooth_edges, output_path)

    queue_manager.update_job(
        job.id,
        status=JobStatus.COMPLETED,
        progress=100,
        message="Détourage terminé ✓",
        result_path=output_path,
    )


async def _detect_is_photo(input_bytes: bytes) -> bool:
    """Heuristic: photos have many unique colors, logos have few."""
    def _check():
        try:
            from PIL import Image
            import io
            img = Image.open(io.BytesIO(input_bytes))
            # Sample a small version for speed
            img_small = img.convert("RGB").resize((50, 50))
            pixels = list(img_small.getdata())
            unique = len(set(pixels))
            # Photos typically have 1000+ unique colors even at 50x50
            # Logos/illustrations tend to have fewer
            return unique > 800
        except Exception:
            return False
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _check)


def _smooth_edges(output_path: str) -> None:
    """Apply a subtle gaussian blur on the alpha channel to smooth jagged edges."""
    try:
        from PIL import Image, ImageFilter
        if not os.path.exists(output_path):
            return
        img = Image.open(output_path).convert("RGBA")
        r, g, b, a = img.split()
        # Very subtle smooth on alpha to remove aliasing artifacts
        a_smoothed = a.filter(ImageFilter.GaussianBlur(radius=0.5))
        result = Image.merge("RGBA", (r, g, b, a_smoothed))
        result.save(output_path, "PNG", optimize=True)
    except Exception:
        pass  # Non-critical
