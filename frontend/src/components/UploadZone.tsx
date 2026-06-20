"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, ImagePlus, Layers, Cpu, CheckCircle2 } from "lucide-react";
import type { JobMode } from "@/hooks/useJobQueue";

interface UploadZoneProps {
  mode: JobMode;
  onUpload: (files: File[], params?: { blacklevel: string; alphamax: string; opttolerance: string }) => void;
  isDisabled?: boolean;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/bmp";
const FORMAT_LABELS = ["JPG", "PNG", "WEBP", "GIF", "BMP"];

export function UploadZone({
  mode,
  onUpload,
  isDisabled,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  
  // Potrace advanced parameters
  const [params, setParams] = useState({
    blacklevel: "0.5",
    alphamax: "1.0",
    opttolerance: "0.2"
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const validFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
      if (validFiles.length === 0) return;
      
      const firstFile = validFiles[0];
      const url = URL.createObjectURL(firstFile);
      setPreview(url);
      setPreviewName(validFiles.length > 1 ? `${validFiles.length} fichiers ajoutés` : firstFile.name);
      
      onUpload(validFiles, mode === "vectorize" ? params : undefined);
      
      // Reset after submit
      setTimeout(() => {
        setPreview(null);
        setPreviewName("");
        URL.revokeObjectURL(url);
      }, 1200);
    },
    [onUpload, mode, params]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  };

  const Icon = mode === "vectorize" ? Cpu : Layers;
  const label = mode === "vectorize" ? "Vectoriser" : "Suppression de Fond";
  const desc = mode === "vectorize" ? "→ SVG vectoriel (potrace)" : "→ PNG transparent (rembg)";

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-4 py-2 bg-panel rounded-xl border border-subtle">
          <Icon size={16} className={mode === "vectorize" ? "text-forge-cyan" : "text-forge-violet"} />
          <span className="text-sm font-semibold text-ink-primary">{label}</span>
        </div>
        <span className="text-[10px] font-mono text-ink-muted">
          {desc}
        </span>
      </div>

      {/* Removed Advanced Settings for Vectorize */}

      {/* Drop zone */}
      <motion.div
        onClick={() => !isDisabled && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        animate={{
          scale: isDragging ? 1.01 : 1,
          borderColor: isDragging ? (mode === "vectorize" ? "#06b6d4" : "#7c3aed") : "transparent",
        }}
        transition={{ duration: 0.2 }}
        className={`relative rounded-2xl overflow-hidden cursor-pointer select-none
          ${isDragging ? "upload-border-active" : "upload-border"}
          bg-panel min-h-[220px] flex flex-col items-center justify-center gap-4
          transition-all duration-300
          ${isDragging ? "bg-forge-violet-glow shadow-glow-violet" : "hover:bg-elevated"}
          ${isDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={onInputChange}
          disabled={isDisabled}
        />

        <AnimatePresence mode="wait">
          {preview ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="preview"
                className="h-24 w-auto rounded-lg object-contain border border-subtle"
              />
              <div className="flex items-center gap-2 text-status-completed">
                <CheckCircle2 size={16} />
                <span className="text-sm font-semibold">{previewName}</span>
              </div>
              <p className="text-[11px] font-mono text-ink-muted">
                Ajouté à la file de traitement...
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center gap-4 px-8 py-4 text-center"
            >
              <motion.div
                animate={
                  isDragging
                    ? { scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }
                    : {}
                }
                transition={{ duration: 0.4 }}
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  isDragging
                    ? "bg-gradient-forge shadow-glow-violet"
                    : "bg-elevated"
                }`}
              >
                {isDragging ? (
                  <ImagePlus size={28} className="text-white" />
                ) : (
                  <Upload size={26} className="text-ink-muted" />
                )}
              </motion.div>

              <div>
                <p className="text-sm font-semibold text-ink-primary">
                  {isDragging
                    ? "Relâchez pour déposer"
                    : "Déposez votre image ici"}
                </p>
                <p className="text-xs text-ink-muted mt-1">
                  ou{" "}
                  <span className="text-forge-violet-light underline">
                    parcourez votre ordinateur
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {FORMAT_LABELS.map((fmt) => (
                  <span
                    key={fmt}
                    className="px-2 py-0.5 bg-elevated rounded text-[10px] font-mono text-ink-muted border border-subtle"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
