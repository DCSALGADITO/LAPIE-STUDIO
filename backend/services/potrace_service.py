import asyncio
import io
import os

from models.job import Job, JobStatus


async def process_vectorize(job: Job, input_bytes: bytes, output_path: str) -> None:
    from services.queue_manager import queue_manager

    bmp_path = output_path.replace(".svg", "_tmp.bmp")

    try:
        # Step 1: Preprocess — upscale + sharpen + optimal threshold (Otsu)
        queue_manager.update_job(job.id, progress=15, message="Prétraitement de l'image (upscale + netteté)...")

        def _to_bmp() -> tuple[str, float]:
            from PIL import Image, ImageFilter, ImageOps
            import statistics

            img = Image.open(io.BytesIO(input_bytes))

            # Composite RGBA over white background
            if img.mode == "RGBA":
                bg = Image.new("RGB", img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[3])
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")

            # Upscale 2× for better curve fidelity
            w, h = img.size
            if max(w, h) < 2000:
                img = img.resize((w * 2, h * 2), Image.LANCZOS)

            # Sharpen to accentuate edges before binarization
            img = img.filter(ImageFilter.SHARPEN)
            img = img.filter(ImageFilter.SHARPEN)  # Double pass for crispness

            gray = img.convert("L")

            # Otsu's thresholding: find optimal split point
            histogram = gray.histogram()
            total = sum(histogram)
            sum_all = sum(i * histogram[i] for i in range(256))

            best_threshold = 128.0
            best_variance = 0.0
            weight_bg = 0
            sum_bg = 0.0

            for t in range(256):
                weight_bg += histogram[t]
                if weight_bg == 0:
                    continue
                weight_fg = total - weight_bg
                if weight_fg == 0:
                    break

                sum_bg += t * histogram[t]
                mean_bg = sum_bg / weight_bg
                mean_fg = (sum_all - sum_bg) / weight_fg

                variance = weight_bg * weight_fg * (mean_bg - mean_fg) ** 2
                if variance > best_variance:
                    best_variance = variance
                    best_threshold = t

            # Apply threshold
            binary = gray.point(lambda x: 0 if x < best_threshold else 255, '1')
            binary.save(bmp_path, "BMP")
            return bmp_path, best_threshold / 255.0

        loop = asyncio.get_event_loop()
        _, computed_blacklevel = await loop.run_in_executor(None, _to_bmp)

        queue_manager.update_job(job.id, progress=45, message="Vectorisation avec Potrace (paramètres optimisés)...")
        await asyncio.sleep(0.05)

        # Step 2: potrace with optimized parameters for sharp, clean SVGs
        params = job.vectorize_params or {}
        # Use computed blacklevel from Otsu if not overridden
        blacklevel = params.get("blacklevel", str(round(computed_blacklevel, 2)))
        alphamax = params.get("alphamax", "0.5")       # Sharper corners for logos
        opttolerance = params.get("opttolerance", "0.1")  # More faithful curves

        cmd = [
            "potrace",
            "--svg",
            "--output", output_path,
            "--blacklevel", str(blacklevel),
            "--alphamax", str(alphamax),
            "--opttolerance", str(opttolerance),
            "--unit", "96",     # Standard screen DPI
            bmp_path,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        queue_manager.update_job(job.id, progress=70, message="Tracé des courbes de Bézier...")
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            raise RuntimeError(f"potrace a échoué: {stderr.decode().strip()}")

        # Step 3: Clean up SVG (remove potrace metadata, set clean viewBox)
        queue_manager.update_job(job.id, progress=88, message="Nettoyage et optimisation du SVG...")
        await loop.run_in_executor(None, _clean_svg, output_path)

        queue_manager.update_job(
            job.id,
            status=JobStatus.COMPLETED,
            progress=100,
            message="Vectorisation terminée ✓",
            result_path=output_path,
        )

    finally:
        if os.path.exists(bmp_path):
            os.unlink(bmp_path)


def _clean_svg(svg_path: str) -> None:
    """Remove potrace metadata and clean up the SVG output."""
    try:
        with open(svg_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Remove generator metadata comment
        import re
        content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)

        # Ensure xmlns is present
        if 'xmlns=' not in content:
            content = content.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"', 1)

        with open(svg_path, 'w', encoding='utf-8') as f:
            f.write(content.strip())
    except Exception:
        pass  # Non-critical, keep original SVG if cleanup fails
