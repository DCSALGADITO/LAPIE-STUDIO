"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Shuffle, CheckCircle2, XCircle, AlertCircle, Palette } from "lucide-react";
import type { ColorInfo } from "@/lib/api";

interface ColorHarmonyPanelProps {
  detectedColors?: ColorInfo[];
}

type HarmonyType = "Complémentaire" | "Analogue" | "Triadique" | "Tétradique" | "Monochromatique";

interface HarmonyResult {
  type: HarmonyType;
  score: number; // 0–100
  label: string;
  description: string;
  colors: string[];
}

// ── Color math helpers ──────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hueDiff(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

/** Evaluate harmonic score (0-100) for a set of colors */
function evaluateHarmony(hexColors: string[]): HarmonyResult {
  if (hexColors.length < 2) {
    return { type: "Monochromatique", score: 50, label: "Indéterminé", description: "Ajoutez au moins 2 couleurs.", colors: hexColors };
  }

  const hsls = hexColors.map(hexToHsl);
  const hues = hsls.map(([h]) => h);
  const sats = hsls.map(([, s]) => s);
  const lums = hsls.map(([, , l]) => l);

  // Check monochromatic: all hues within 20°, varied lightness
  const hueSpread = Math.max(...hues) - Math.min(...hues);
  const lumSpread = Math.max(...lums) - Math.min(...lums);
  const satSpread = Math.max(...sats) - Math.min(...sats);

  const avgSat = sats.reduce((a, b) => a + b, 0) / sats.length;

  // Check complementary (2 colors ~180° apart)
  if (hexColors.length === 2) {
    const diff = hueDiff(hues[0], hues[1]);
    if (diff > 150 && diff < 210) {
      const score = 100 - Math.abs(diff - 180) * 2;
      return { type: "Complémentaire", score, label: "Complémentaire", description: "Contraste élevé, dynamique et impactant. Idéal pour CTA.", colors: hexColors };
    }
    if (diff < 40) {
      const score = Math.max(0, 90 - diff);
      return { type: "Analogue", score, label: "Analogue", description: "Harmonie douce et cohérente. Excellent pour les dégradés.", colors: hexColors };
    }
  }

  // Check triadic (3 colors ~120° apart)
  if (hexColors.length >= 3) {
    const sorted = [...hues].sort((a, b) => a - b);
    const gaps = sorted.map((h, i) => hueDiff(h, sorted[(i + 1) % sorted.length]));
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const gapVariance = Math.max(...gaps) - Math.min(...gaps);

    if (Math.abs(avgGap - 120) < 30 && gapVariance < 50) {
      const score = Math.max(0, 100 - gapVariance * 1.5);
      return { type: "Triadique", score, label: "Triadique", description: "Palette vibrante et équilibrée. Parfaite pour une DA audacieuse.", colors: hexColors };
    }

    if (hexColors.length >= 4) {
      const gap2 = Math.abs(avgGap - 90);
      if (gap2 < 25) {
        const score = Math.max(0, 100 - gap2 * 2);
        return { type: "Tétradique", score, label: "Tétradique", description: "Richesse chromatique maximale. Requiert une hiérarchie claire.", colors: hexColors };
      }
    }
  }

  // Monochromatic fallback
  if (hueSpread < 30 && lumSpread > 20) {
    return { type: "Monochromatique", score: 80, label: "Monochromatique", description: "Élégance épurée et cohérence visuelle forte.", colors: hexColors };
  }

  // Low saturation: professional, neutral
  if (avgSat < 20) {
    return { type: "Monochromatique", score: 65, label: "Palette neutre", description: "Sobre et professionnel, mais peut manquer de dynamisme.", colors: hexColors };
  }

  // Generic "works but not ideal"
  const clashScore = Math.max(0, 50 - hueSpread / 6);
  return { type: "Analogue", score: clashScore, label: "Contraste libre", description: "Palette personnalisée. Vérifiez la hiérarchie visuelle.", colors: hexColors };
}

// ── Component ───────────────────────────────────────────────────

export function ColorHarmonyPanel({ detectedColors = [] }: ColorHarmonyPanelProps) {
  const [palette, setPalette] = useState<string[]>(
    detectedColors.slice(0, 3).map(c => c.hex) || ["#5e5ce6", "#06b6d4", "#f5f5f7"]
  );

  const harmony = evaluateHarmony(palette);
  const scoreColor = harmony.score >= 75 ? "text-status-completed" : harmony.score >= 50 ? "text-status-processing" : "text-status-failed";
  const scoreBg = harmony.score >= 75 ? "bg-status-completed/10" : harmony.score >= 50 ? "bg-status-processing/10" : "bg-status-failed/10";
  const ScoreIcon = harmony.score >= 75 ? CheckCircle2 : harmony.score >= 50 ? AlertCircle : XCircle;

  const addColor = useCallback(() => {
    if (palette.length >= 8) return;
    // Generate a complementary-ish hue
    const lastHsl = hexToHsl(palette[palette.length - 1]);
    const newHue = (lastHsl[0] + 60) % 360;
    setPalette(prev => [...prev, hslToHex(newHue, 65, 55)]);
  }, [palette]);

  const removeColor = (idx: number) => {
    if (palette.length <= 2) return;
    setPalette(prev => prev.filter((_, i) => i !== idx));
  };

  const updateColor = (idx: number, hex: string) => {
    setPalette(prev => prev.map((c, i) => i === idx ? hex : c));
  };

  const importDetected = () => {
    const toImport = detectedColors.slice(0, 6).map(c => c.hex);
    if (toImport.length > 0) setPalette(toImport);
  };

  const randomize = () => {
    const baseHue = Math.floor(Math.random() * 360);
    const newPalette = Array.from({ length: palette.length }, (_, i) => {
      const h = (baseHue + i * (360 / palette.length)) % 360;
      return hslToHex(h, 60 + Math.random() * 20, 45 + Math.random() * 20);
    });
    setPalette(newPalette);
  };

  return (
    <section className="bg-elevated/60 backdrop-blur-xl border border-subtle rounded-3xl p-7 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-forge-violet/10 rounded-xl">
            <Palette size={18} className="text-forge-violet" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink-primary">Palette Personnalisée</h2>
            <p className="text-xs text-ink-muted">{palette.length} couleur{palette.length > 1 ? 's' : ''} · Vérification d'harmonie chromatique</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {detectedColors.length > 0 && (
            <button
              onClick={importDetected}
              className="text-xs font-medium px-3 py-1.5 rounded-xl border border-subtle bg-elevated hover:bg-panel transition-colors text-ink-secondary"
            >
              Importer détectées
            </button>
          )}
          <button
            onClick={randomize}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-subtle bg-elevated hover:bg-panel transition-colors text-ink-secondary"
          >
            <Shuffle size={12} /> Aléatoire
          </button>
          {palette.length < 8 && (
            <button
              onClick={addColor}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-forge-violet text-white hover:bg-forge-violet/90 transition-colors"
            >
              <Plus size={12} /> Couleur
            </button>
          )}
        </div>
      </div>

      {/* Color pickers */}
      <div className="flex flex-wrap gap-3 mb-6">
        <AnimatePresence mode="popLayout">
          {palette.map((color, idx) => (
            <motion.div
              key={idx}
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="group relative flex flex-col items-center gap-2"
            >
              <div className="relative">
                <div
                  className="w-16 h-16 rounded-2xl shadow-md ring-2 ring-white/20 cursor-pointer overflow-hidden"
                  style={{ backgroundColor: color }}
                >
                  <input
                    type="color"
                    value={color}
                    onChange={e => updateColor(idx, e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                </div>
                {palette.length > 2 && (
                  <button
                    onClick={() => removeColor(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-status-failed text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  >
                    <Trash2 size={9} />
                  </button>
                )}
              </div>
              <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">{color}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Preview band */}
      <div className="h-8 rounded-xl overflow-hidden flex mb-5 shadow-sm">
        {palette.map((color, idx) => (
          <div key={idx} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>

      {/* Harmony Result */}
      <div className={`flex items-start gap-4 p-4 rounded-2xl border ${scoreBg} border-current/10`}>
        <div className={`flex-shrink-0 p-2.5 rounded-xl ${scoreBg}`}>
          <ScoreIcon size={20} className={scoreColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className={`text-sm font-bold ${scoreColor}`}>{harmony.label}</span>
            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${scoreBg} ${scoreColor}`}>
              {harmony.score}/100
            </span>
          </div>
          <p className="text-xs text-ink-secondary">{harmony.description}</p>
        </div>
        {/* Score bar */}
        <div className="flex-shrink-0 w-24">
          <div className="h-2 bg-elevated rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: harmony.score >= 75 ? "#32d74b" : harmony.score >= 50 ? "#f5a623" : "#ff375f" }}
              initial={{ width: 0 }}
              animate={{ width: `${harmony.score}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <p className="text-[10px] font-mono text-ink-muted text-right mt-1">{harmony.score}%</p>
        </div>
      </div>

      {/* Quick tips */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: "Complémentaire", tip: "2 couleurs opposées (180°)", good: true },
          { label: "Analogue", tip: "3 teintes adjacentes (30°)", good: true },
          { label: "Triadique", tip: "3 teintes réparties (120°)", good: true },
          { label: "À éviter", tip: ">5 couleurs saturées sans hiérarchie", good: false },
        ].map((item, i) => (
          <div key={i} className={`flex items-start gap-2 p-2.5 rounded-xl ${item.good ? 'bg-status-completed/5 border border-status-completed/15' : 'bg-status-failed/5 border border-status-failed/15'}`}>
            {item.good ? <CheckCircle2 size={12} className="text-status-completed mt-0.5 flex-shrink-0" /> : <XCircle size={12} className="text-status-failed mt-0.5 flex-shrink-0" />}
            <div>
              <p className="text-[10px] font-semibold text-ink-primary">{item.label}</p>
              <p className="text-[10px] text-ink-muted">{item.tip}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
