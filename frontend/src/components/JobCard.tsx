"use client";

import { motion } from "framer-motion";
import {
  Layers,
  Cpu,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Trash2,
  Eye,
} from "lucide-react";
import { useSSE } from "@/hooks/useSSE";
import { getResultUrl } from "@/lib/api";
import type { FrontendJob } from "@/hooks/useJobQueue";

interface JobCardProps {
  job: FrontendJob;
  onUpdate: (id: string, updates: Partial<FrontendJob>) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(start: number, end: number | null): string {
  const ms = ((end ?? Date.now()) - start);
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: "text-status-pending",
    bg: "bg-status-pending/10",
    border: "border-status-pending/30",
    label: "ATTENTE",
  },
  processing: {
    icon: Loader2,
    color: "text-status-processing",
    bg: "bg-status-processing/10",
    border: "border-status-processing/30",
    label: "TRAITEMENT",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-status-completed",
    bg: "bg-status-completed/10",
    border: "border-status-completed/30",
    label: "TERMINÉ",
  },
  failed: {
    icon: XCircle,
    color: "text-status-failed",
    bg: "bg-status-failed/10",
    border: "border-status-failed/30",
    label: "ERREUR",
  },
};

export function JobCard({ job, onUpdate, onRemove, onSelect }: JobCardProps) {
  // Subscribe to SSE for live updates
  useSSE(
    job.status !== "completed" && job.status !== "failed" ? job.id : null,
    (data) => {
      onUpdate(job.id, {
        status: data.status,
        progress: data.progress,
        message: data.message,
        resultExtension: data.result_extension,
        completedAt: data.completed_at ? data.completed_at * 1000 : null,
        error: data.error,
      });
    }
  );

  const cfg = STATUS_CONFIG[job.status];
  const StatusIcon = cfg.icon;
  const ModeIcon = job.mode === "remove_bg" ? Layers : Cpu;

  const isProcessing = job.status === "processing";
  const isCompleted = job.status === "completed";
  const isDone = isCompleted || job.status === "failed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`bg-panel rounded-xl border ${
        isProcessing ? "border-forge-violet/40" : "border-subtle"
      } overflow-hidden transition-all duration-300 ${
        isProcessing ? "shadow-glow-violet" : ""
      }`}
    >
      <div className="p-4 flex items-start gap-4">
        {/* Thumbnail / mode icon */}
        <div className="relative shrink-0">
          {job.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.previewUrl}
              alt={job.filename}
              className="w-14 h-14 rounded-lg object-cover border border-subtle"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-elevated border border-subtle flex items-center justify-center">
              <ModeIcon size={22} className="text-ink-muted" />
            </div>
          )}
          {/* Mode badge */}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md bg-gradient-forge flex items-center justify-center">
            <ModeIcon size={10} className="text-white" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Row 1: filename + status */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-primary truncate leading-tight">
              {job.filename}
            </p>
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold shrink-0 ${cfg.color} ${cfg.bg} ${cfg.border}`}
            >
              <StatusIcon
                size={10}
                className={isProcessing ? "animate-spin" : ""}
              />
              {cfg.label}
            </div>
          </div>

          {/* Row 2: metadata */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-ink-muted">
              #{job.id}
            </span>
            <span className="font-mono text-[10px] text-ink-muted">
              {formatBytes(job.fileSize)}
            </span>
            <span className="font-mono text-[10px] text-ink-muted">
              {job.mode === "remove_bg" ? "PNG" : "SVG"}
            </span>
            {isDone && (
              <span className="font-mono text-[10px] text-ink-muted">
                ⏱ {formatDuration(job.createdAt, job.completedAt)}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {!isDone && (
            <div className="space-y-1">
              <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full relative overflow-hidden"
                  style={{
                    background:
                      "linear-gradient(90deg, #7c3aed, #06b6d4)",
                  }}
                  initial={{ width: "0%" }}
                  animate={{ width: `${job.progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  {isProcessing && (
                    <div className="absolute inset-0 progress-shimmer" />
                  )}
                </motion.div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono text-ink-muted truncate">
                  {job.message}
                </p>
                <span className="text-[10px] font-mono text-forge-violet-light ml-2 shrink-0">
                  {job.progress}%
                </span>
              </div>
            </div>
          )}

          {/* Completed: message */}
          {isDone && (
            <p
              className={`text-[10px] font-mono truncate ${
                isCompleted ? "text-status-completed" : "text-status-failed"
              }`}
            >
              {job.message}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          {isCompleted && (
            <>
              <motion.a
                href={getResultUrl(job.id)}
                download
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-8 h-8 rounded-lg bg-gradient-forge flex items-center justify-center shadow-glow-violet"
                title="Télécharger"
              >
                <Download size={14} className="text-white" />
              </motion.a>
              <motion.button
                onClick={() => onSelect(job.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-8 h-8 rounded-lg bg-elevated border border-subtle flex items-center justify-center text-ink-muted hover:text-ink-primary transition-colors"
                title="Voir le résultat"
              >
                <Eye size={14} />
              </motion.button>
            </>
          )}
          <motion.button
            onClick={() => onRemove(job.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-8 h-8 rounded-lg bg-elevated border border-subtle flex items-center justify-center text-ink-muted hover:text-status-failed transition-colors"
            title="Supprimer"
          >
            <Trash2 size={13} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
