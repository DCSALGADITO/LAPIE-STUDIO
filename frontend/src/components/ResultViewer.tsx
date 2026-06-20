"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Move, Layers, Cpu } from "lucide-react";
import { getOriginalUrl, getResultUrl } from "@/lib/api";
import type { FrontendJob } from "@/hooks/useJobQueue";

interface ResultViewerProps {
  job: FrontendJob;
  onClose: () => void;
}

export function ResultViewer({ job, onClose }: ResultViewerProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const ModeIcon = job.mode === "remove_bg" ? Layers : Cpu;

  const updateSlider = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (isDragging) updateSlider(e.clientX);
  };
  const onMouseUp = () => setIsDragging(false);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  });

  const onTouchMove = (e: React.TouchEvent) => {
    updateSlider(e.touches[0].clientX);
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isSvg = job.resultExtension === "svg";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="bg-panel rounded-2xl border border-subtle w-full max-w-4xl overflow-hidden shadow-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-forge flex items-center justify-center">
                <ModeIcon size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-primary">
                  {job.filename}
                </p>
                <p className="text-[10px] font-mono text-ink-muted">
                  #{job.id} ·{" "}
                  {job.mode === "remove_bg" ? "Suppression de fond" : "Vectorisation"} ·{" "}
                  {isSvg ? "SVG" : "PNG transparent"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.a
                href={getResultUrl(job.id)}
                download
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-forge rounded-lg text-xs font-semibold text-white shadow-glow-violet"
              >
                <Download size={13} />
                Télécharger {isSvg ? "SVG" : "PNG"}
              </motion.a>
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-9 h-9 rounded-lg bg-elevated border border-subtle flex items-center justify-center text-ink-muted hover:text-ink-primary transition-colors"
              >
                <X size={15} />
              </motion.button>
            </div>
          </div>

          {/* Comparison slider */}
          <div className="p-6">
            {!isSvg ? (
              <>
                {/* Before/After slider — only for raster images */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-ink-muted px-2 py-0.5 bg-elevated rounded border border-subtle">
                      AVANT
                    </span>
                    <div className="flex items-center gap-1 text-ink-muted/40">
                      <Move size={11} />
                      <span className="text-[10px] font-mono">Glisser pour comparer</span>
                    </div>
                    <span className="text-[10px] font-mono text-forge-cyan px-2 py-0.5 bg-elevated rounded border border-subtle">
                      APRÈS
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-ink-muted">
                    {Math.round(sliderPos)}%
                  </span>
                </div>

                <div
                  ref={containerRef}
                  className="relative rounded-xl overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMWExYTI0Ii8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMxYTFhMjQiLz48cmVjdCB4PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMTExMTE4Ii8+PHJlY3QgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzExMTExOCIvPjwvc3ZnPg==')] select-none cursor-ew-resize"
                  style={{ height: "420px" }}
                  onMouseDown={() => setIsDragging(true)}
                  onTouchMove={onTouchMove}
                  onClick={(e) => updateSlider(e.clientX)}
                >
                  {/* Original (full width) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getOriginalUrl(job.id)}
                    alt="Original"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                  {/* Result (clipped) */}
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${sliderPos}%` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getResultUrl(job.id)}
                      alt="Résultat"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      style={{ width: `${10000 / sliderPos}%`, maxWidth: "none" }}
                      draggable={false}
                    />
                  </div>
                  {/* Divider */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-lg"
                    style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                      <Move size={14} className="text-slate-700" />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* SVG preview */
              <div className="rounded-xl overflow-hidden bg-elevated border border-subtle flex items-center justify-center" style={{ height: "420px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getResultUrl(job.id)}
                  alt="SVG résultat"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
