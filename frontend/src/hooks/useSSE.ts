import { useEffect, useRef } from "react";
import { getStreamUrl } from "@/lib/api";

export interface SSEJobData {
  id: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  message: string;
  created_at: number;
  completed_at: number | null;
  error: string | null;
  result_path: string | null;
  original_filename: string;
  file_size: number;
  result_extension: string;
}

export function useSSE(
  jobId: string | null,
  onUpdate: (data: SSEJobData) => void
) {
  // Stable ref to avoid stale closure issues
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!jobId || jobId.startsWith("UPLOADING_")) return;

    const url = getStreamUrl(jobId);
    const es = new EventSource(url);

    es.addEventListener("update", (event: MessageEvent) => {
      try {
        const data: SSEJobData = JSON.parse(event.data);
        onUpdateRef.current(data);
        if (data.status === "completed" || data.status === "failed") {
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [jobId]);
}
