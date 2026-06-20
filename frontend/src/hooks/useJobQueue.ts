import { useCallback, useState } from "react";
import { removeBg, vectorize } from "@/lib/api";

export type JobMode = "remove_bg" | "vectorize";

export interface FrontendJob {
  id: string;
  mode: JobMode;
  filename: string;
  fileSize: number;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  message: string;
  previewUrl: string | null;
  resultExtension: string;
  createdAt: number;
  completedAt: number | null;
  error: string | null;
}

export function useJobQueue() {
  const [jobs, setJobs] = useState<FrontendJob[]>([]);

  const updateJob = useCallback((id: string, updates: Partial<FrontendJob>) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, ...updates } : j))
    );
  }, []);

  const submitJob = useCallback(
    async (file: File, mode: JobMode, params?: any): Promise<string | null> => {
      const tempId = `UPLOADING_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const previewUrl = URL.createObjectURL(file);

      const pending: FrontendJob = {
        id: tempId,
        mode,
        filename: file.name,
        fileSize: file.size,
        status: "pending",
        progress: 0,
        message: "Envoi du fichier...",
        previewUrl,
        resultExtension: mode === "vectorize" ? "svg" : "png",
        createdAt: Date.now(),
        completedAt: null,
        error: null,
      };

      setJobs((prev) => [pending, ...prev]);

      try {
        const result = mode === "remove_bg" ? await removeBg(file) : await vectorize(file, params);
        const { job_id } = result;

        setJobs((prev) =>
          prev.map((j) =>
            j.id === tempId
              ? { ...j, id: job_id, message: "En file d'attente..." }
              : j
          )
        );
        return job_id;
      } catch (err) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === tempId
              ? {
                  ...j,
                  status: "failed",
                  message:
                    err instanceof Error ? err.message : "Erreur d'envoi",
                  error: "upload_failed",
                }
              : j
          )
        );
        return null;
      }
    },
    []
  );

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => {
      const job = prev.find((j) => j.id === id);
      if (job?.previewUrl) URL.revokeObjectURL(job.previewUrl);
      return prev.filter((j) => j.id !== id);
    });
  }, []);

  return { jobs, submitJob, updateJob, removeJob };
}
