import asyncio
import time
from typing import Any, Callable, Coroutine, Dict, Optional

from models.job import Job, JobStatus, JobType


class QueueManager:
    def __init__(self) -> None:
        self.queue: asyncio.Queue = asyncio.Queue()
        self.jobs: Dict[str, Job] = {}
        self._running = False

    def create_job(
        self,
        job_type: JobType,
        filename: str,
        file_size: int,
        result_extension: str = "png",
    ) -> Job:
        job = Job(
            type=job_type,
            original_filename=filename,
            file_size=file_size,
            result_extension=result_extension,
        )
        self.jobs[job.id] = job
        return job

    async def enqueue(
        self, job: Job, handler: Callable[..., Coroutine], *args: Any
    ) -> None:
        await self.queue.put((job, handler, args))

    def update_job(
        self,
        job_id: str,
        status: Optional[JobStatus] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        result_path: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        job = self.jobs.get(job_id)
        if not job:
            return
        if status is not None:
            job.status = status
        if progress is not None:
            job.progress = progress
        if message is not None:
            job.message = message
        if result_path is not None:
            job.result_path = result_path
        if error is not None:
            job.error = error
        if status in (JobStatus.COMPLETED, JobStatus.FAILED):
            job.completed_at = time.time()

    def get_job(self, job_id: str) -> Optional[Job]:
        return self.jobs.get(job_id)

    async def start_worker(self) -> None:
        self._running = True
        while self._running:
            try:
                job, handler, args = await asyncio.wait_for(
                    self.queue.get(), timeout=1.0
                )
                self.update_job(
                    job.id,
                    status=JobStatus.PROCESSING,
                    progress=5,
                    message="Démarrage du traitement...",
                )
                try:
                    await handler(job, *args)
                except Exception as exc:
                    self.update_job(
                        job.id,
                        status=JobStatus.FAILED,
                        error=str(exc),
                        message=f"Erreur: {exc}",
                        progress=0,
                    )
                finally:
                    self.queue.task_done()
            except asyncio.TimeoutError:
                continue

    def stop_worker(self) -> None:
        self._running = False


queue_manager = QueueManager()
