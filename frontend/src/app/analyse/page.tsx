"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Palette, Type, Image as ImageIcon, Download,
  ArrowLeft, Bird, Server, Zap, Layers, Cpu, Sparkles, Copy, CheckCheck,
  Globe, Shield, Layout, Smartphone, Maximize2, CheckCircle2, XCircle,
  AlertTriangle, Eye, Code, MousePointer, Square, User, History, X, LogOut
} from "lucide-react";
import {
  scrapeUrl, ScrapeResponse, ColorInfo, FontInfo,
  SeoInfo, AccessibilityInfo, ComponentInfo, SpacingInfo, ResponsiveInfo,
} from "@/lib/api";
import { useJobQueue } from "@/hooks/useJobQueue";
import { useHistory } from "@/hooks/useHistory";
import type { FrontendJob } from "@/hooks/useJobQueue";
import { ColorHarmonyPanel } from "@/components/ColorHarmonyPanel";
import { AuthModal } from "@/components/AuthModal";
import jsPDF from "jspdf";

// ────────────────────────── Role Labels ────────────────────────
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  primary:    { label: "Primaire",    color: "bg-blue-100 text-blue-700" },
  accent:     { label: "Accent",      color: "bg-purple-100 text-purple-700" },
  background: { label: "Fond",        color: "bg-gray-100 text-gray-600" },
  text:       { label: "Texte",       color: "bg-stone-100 text-stone-700" },
  neutral:    { label: "Neutre",      color: "bg-slate-100 text-slate-600" },
  heading:    { label: "Titres",      color: "bg-violet-100 text-violet-700" },
  body:       { label: "Corps",       color: "bg-teal-100 text-teal-700" },
  monospace:  { label: "Code",        color: "bg-orange-100 text-orange-700" },
  ui:         { label: "Interface",   color: "bg-sky-100 text-sky-700" },
};

const DA_DESCRIPTIONS: Record<string, { desc: string; tags: string[]; palette_advice: string }> = {
  "Dark Premium":           { desc: "Palette sombre et sophistiquée. Contraste élevé, luxe et modernité.", tags: ["Luxe", "Tech", "Premium"], palette_advice: "Associez un accent vibrant (violet, cyan) sur fond très sombre." },
  "Dark Minimaliste":       { desc: "Design épuré sur fond sombre. Focus absolu sur le contenu.", tags: ["SaaS", "Dev", "Portfolio"], palette_advice: "1 accent chromatique sur palette de gris foncés." },
  "Minimaliste Monochrome": { desc: "Palette épurée à dominante monochrome. Clarté et élégance.", tags: ["Editorial", "Mode", "Luxe"], palette_advice: "Jouez sur les contrastes de valeur plutôt que de teinte." },
  "Minimaliste & Épuré":    { desc: "Design neutre et aéré. Focus sur le contenu, zéro bruit visuel.", tags: ["Blog", "Portfolio", "B2B"], palette_advice: "1 couleur d'accent suffit. Laissez respirer le blanc." },
  "Coloré & Dynamique":     { desc: "Palette riche et vivante. Énergie, créativité et diversité visuelle.", tags: ["Startup", "Créatif", "Jeunesse"], palette_advice: "Définissez une hiérarchie claire : primaire + 2 accents max." },
  "Bold & Impactant":       { desc: "Couleurs fortes et saturées. Identité affirmée, mémorable.", tags: ["Marketing", "Sport", "Pub"], palette_advice: "La complémentarité des couleurs est clé pour le contraste." },
  "Moderne & Affirmé":      { desc: "Équilibre entre neutralité et couleur. DA contemporaine et confiante.", tags: ["Agence", "SaaS", "Consulting"], palette_advice: "Palette de 3 : primaire + neutre + accent discret." },
  "Sobre & Professionnel":  { desc: "Palette posée et business. Crédibilité et expertise.", tags: ["Finance", "Santé", "Juridique"], palette_advice: "Bleu marine + blanc + 1 accent chaud pour humaniser." },
  "Indéterminé":            { desc: "Palette difficile à caractériser — analysez le contexte visuel.", tags: ["Varié"], palette_advice: "Identifiez manuellement les 2-3 couleurs dominantes." },
};

// ────────────────────────── Helpers ────────────────────────────
function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function CheckBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${ok ? "bg-status-completed/10 border-status-completed/20 text-status-completed" : "bg-status-failed/10 border-status-failed/20 text-status-failed"}`}>
      {ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {label}
    </div>
  );
}

function StatCard({ icon: Icon, value, label, color = "text-ink-primary" }: { icon: React.ElementType; value: string | number; label: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 bg-white/50 rounded-2xl border border-subtle text-center min-w-[80px]">
      <Icon size={16} className={color} />
      <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
      <p className="text-[10px] text-ink-muted leading-tight">{label}</p>
    </div>
  );
}

// ────────────────────────── PDF Generator ──────────────────────
async function generatePDF(result: ScrapeResponse, siteUrl: string) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PAGE_W = 210, MARGIN = 20, CONTENT_W = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  const addText = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; x?: number; align?: "left" | "center" | "right" } = {}) => {
    pdf.setFontSize(opts.size || 10);
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setTextColor(...(opts.color || [30, 30, 30]));
    pdf.text(text, opts.align === "center" ? PAGE_W / 2 : opts.align === "right" ? PAGE_W - MARGIN : opts.x ?? MARGIN, y, { align: opts.align || "left" });
  };
  const nl = (h = 6) => { y += h; };
  const check = (n = 20) => { if (y + n > 280) { pdf.addPage(); y = MARGIN; } };

  pdf.setFillColor(94, 92, 230);
  pdf.rect(0, 0, PAGE_W, 14, "F");
  pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.setTextColor(255, 255, 255);
  pdf.text("LAPIE Studio — Rapport d'Analyse UX/UI", MARGIN, 9);
  pdf.text(new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }), PAGE_W - MARGIN, 9, { align: "right" });

  y = 28;
  addText("Rapport d'Analyse UX/UI", { size: 24, bold: true, color: [20, 20, 30], align: "center" });
  nl(8);
  pdf.setFillColor(245, 245, 247); pdf.roundedRect(MARGIN, y, CONTENT_W, 9, 2, 2, "F");
  addText(siteUrl, { size: 9, color: [100, 100, 120], x: MARGIN + 4 }); y += 9; nl(10);

  // DA
  pdf.setFillColor(248, 246, 255); pdf.setDrawColor(94, 92, 230); pdf.setLineWidth(0.3);
  pdf.roundedRect(MARGIN, y, CONTENT_W, 24, 3, 3, "FD");
  addText("Direction Artistique", { size: 8, color: [94, 92, 230], bold: true, x: MARGIN + 4 }); nl(7);
  addText(result.da_style, { size: 14, bold: true, color: [30, 30, 30], x: MARGIN + 4 }); nl(6);
  const daInfo = DA_DESCRIPTIONS[result.da_style];
  pdf.setFontSize(8); pdf.setFont("helvetica", "normal"); pdf.setTextColor(100, 100, 110);
  if (daInfo) { const lines = pdf.splitTextToSize(daInfo.desc, CONTENT_W - 8); pdf.text(lines, MARGIN + 4, y); y += lines.length * 4 + 4; }
  else { y += 4; }
  nl(8);

  // SEO summary
  check(30);
  pdf.setFillColor(245, 245, 247); pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
  addText("📊  SEO & PERFORMANCE", { size: 10, bold: true, color: [30, 30, 30], x: MARGIN + 3 }); y += 8; nl(3);
  const seo = result.seo;
  pdf.setFontSize(8.5); pdf.setFont("helvetica", "normal"); pdf.setTextColor(30, 30, 30);
  if (seo.title) { pdf.text(`Titre : ${seo.title.slice(0, 80)}`, MARGIN, y); nl(5); }
  if (seo.description) { pdf.text(`Description : ${seo.description.slice(0, 100)}`, MARGIN, y); nl(5); }
  pdf.text(`Temps de réponse : ${seo.response_time_ms}ms | H1 : ${seo.h1_count} | Viewport : ${seo.has_viewport ? "✓" : "✗"} | OG tags : ${seo.og_title ? "✓" : "✗"}`, MARGIN, y); nl(8);

  // Colors
  check(40);
  pdf.setFillColor(245, 245, 247); pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
  addText("🎨  PALETTE DE COULEURS", { size: 10, bold: true, color: [30, 30, 30], x: MARGIN + 3 }); y += 8; nl(4);
  const SW = 14, GAP = 4, PW = 55;
  let cx = MARGIN;
  for (const c of result.colors) {
    check(PW + 8);
    if (cx + PW > PAGE_W - MARGIN) { cx = MARGIN; y += PW + GAP; }
    const rgb = hexToRgb(c.hex);
    if (rgb) pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
    pdf.roundedRect(cx, y, SW, SW, 7, 7, "F");
    pdf.setFontSize(7); pdf.setFont("helvetica", "bold"); pdf.setTextColor(30, 30, 30);
    pdf.text(c.hex.toUpperCase(), cx + SW + 2, y + 5);
    pdf.setFontSize(6.5); pdf.setFont("helvetica", "normal"); pdf.setTextColor(100, 100, 120);
    pdf.text(ROLE_LABELS[c.role]?.label || c.role, cx + SW + 2, y + 10);
    cx += PW;
  }
  y += PW + 8;

  // Fonts
  check(40);
  pdf.setFillColor(245, 245, 247); pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
  addText("🔤  TYPOGRAPHIES", { size: 10, bold: true, color: [30, 30, 30], x: MARGIN + 3 }); y += 8; nl(4);
  for (const font of result.fonts) {
    check(22);
    pdf.setFillColor(252, 252, 253); pdf.setDrawColor(220, 220, 230); pdf.setLineWidth(0.2);
    pdf.roundedRect(MARGIN, y, CONTENT_W, 18, 2, 2, "FD");
    pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.setTextColor(20, 20, 30);
    pdf.text(font.name, MARGIN + 4, y + 7);
    pdf.setFontSize(7); pdf.setFont("helvetica", "normal"); pdf.setTextColor(100, 100, 150);
    if (ROLE_LABELS[font.role]) pdf.text(`[ ${ROLE_LABELS[font.role].label} ]`, MARGIN + 4, y + 13);
    pdf.setFontSize(7); pdf.setTextColor(150, 150, 160);
    pdf.text(`Graisses: ${font.weights.join(", ")}`, PAGE_W - MARGIN - 4, y + 7, { align: "right" });
    y += 21;
  }
  if (!result.fonts.length) { addText("Aucune typographie personnalisée.", { color: [150, 150, 150] }); nl(8); }

  // Footer
  const pc = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= pc; i++) {
    pdf.setPage(i);
    pdf.setFillColor(245, 245, 247); pdf.rect(0, 290, PAGE_W, 10, "F");
    pdf.setFontSize(7); pdf.setFont("helvetica", "normal"); pdf.setTextColor(150, 150, 160);
    pdf.text("Généré par LAPIE Studio", MARGIN, 296);
    pdf.text(`Page ${i} / ${pc}`, PAGE_W - MARGIN, 296, { align: "right" });
  }

  const hostname = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).hostname;
  pdf.save(`LAPIE_Analyse_${hostname}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ────────────────────────── Component ─────────────────────────

function AnalysisContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlParam = searchParams.get("url") || "";

  const { jobs, submitJob } = useJobQueue();

  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [result, setResult] = useState<ScrapeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { history, addHistory, user, supabase } = useHistory();
  useEffect(() => {
    if (!urlParam) { router.push("/"); return; }
    const analyze = async () => {
      setIsAnalyzing(true); setError(null);
      try { setResult(await scrapeUrl(urlParam)); }
      catch (err) { setError(err instanceof Error ? err.message : "Erreur lors de l'analyse"); }
      finally { setIsAnalyzing(false); }
    };
    analyze();
  }, [urlParam, router]);

  useEffect(() => {
    if (!result) return;
    result.fonts.forEach((font) => {
      if (font.google_fonts_url) {
        const existing = document.querySelector(`link[href="${font.google_fonts_url}"]`);
        if (!existing) {
          const link = document.createElement("link");
          link.rel = "stylesheet"; link.href = font.google_fonts_url;
          document.head.appendChild(link);
        }
      }
    });
  }, [result]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHex(text);
    setTimeout(() => setCopiedHex(null), 1500);
  };

  const handleExportPDF = async () => {
    if (!result) return;
    setIsExporting(true);
    try { await generatePDF(result, urlParam); }
    catch { alert("Erreur lors de la génération du PDF."); }
    finally { setIsExporting(false); }
  };

  return (
    <div className="flex flex-col min-h-screen bg-void text-ink-primary font-sans relative">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-forge-violet/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] bg-forge-cyan/15 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-subtle bg-white/60 backdrop-blur-3xl z-20 sticky top-0 shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/")}>
          <Bird size={24} className="text-ink-primary" fill="currentColor" />
          <p className="text-[15px] font-bold text-ink-primary tracking-tight">LAPIE Studio</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-transparent border border-black rounded-full text-black text-xs font-semibold hover:bg-black/5 transition-colors"
          >
            Analyses effectuées
          </button>
          
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-subtle bg-elevated/50 cursor-default">
            <Server size={11} className="text-ink-muted" />
            <span className="text-[11px] text-ink-secondary">API</span>
            <span className="w-2 h-2 rounded-full bg-status-completed animate-pulse" />
          </div>

          <button 
            onClick={() => {
              if (user) supabase.auth.signOut();
              else setIsAuthModalOpen(true);
            }}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-elevated/50 border border-subtle hover:bg-elevated transition-colors"
            title={user ? "Se déconnecter" : "Se connecter"}
          >
            {user ? <LogOut size={14} className="text-ink-secondary" /> : <User size={14} className="text-ink-secondary" />}
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 z-10">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Nav */}
          <div className="flex items-center justify-between">
            <button onClick={() => router.push("/")} className="flex items-center gap-2 text-ink-secondary hover:text-ink-primary transition-colors px-4 py-2 bg-elevated border border-subtle rounded-xl text-sm">
              <ArrowLeft size={15} /> Retour
            </button>
            {result && !isAnalyzing && (
              <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 px-5 py-2 bg-forge-violet hover:bg-forge-violet/90 text-white font-medium rounded-xl text-sm transition-colors disabled:opacity-50 shadow-glow-violet">
                {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {isExporting ? "Génération PDF..." : "Télécharger PDF"}
              </button>
            )}
          </div>

          {/* Loading */}
          {isAnalyzing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 gap-6">
              <div className="w-16 h-16 rounded-full bg-forge-violet/10 flex items-center justify-center">
                <Loader2 size={32} className="text-forge-violet animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-ink-primary font-semibold text-lg mb-1">Analyse en cours…</p>
                <p className="text-ink-muted text-sm font-mono">{urlParam}</p>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {error && !isAnalyzing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 bg-status-failed/10 border border-status-failed/20 text-status-failed rounded-2xl text-center">
              <h2 className="font-bold text-lg mb-1">Analyse impossible</h2>
              <p className="text-sm">{error}</p>
            </motion.div>
          )}

          {/* Results */}
          <AnimatePresence>
            {result && !isAnalyzing && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-16">

                {/* ── DA Style Hero ── */}
                {(() => {
                  const daInfo = DA_DESCRIPTIONS[result.da_style] || DA_DESCRIPTIONS["Indéterminé"];
                  return (
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forge-violet to-forge-cyan p-8 text-white shadow-glow-violet">
                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3 opacity-80">
                              <Sparkles size={16} />
                              <span className="text-sm font-mono uppercase tracking-widest">Direction Artistique Détectée</span>
                            </div>
                            <h1 className="text-4xl font-bold mb-2">{result.da_style}</h1>
                            <p className="text-white/80 text-base max-w-xl">{daInfo.desc}</p>
                            <p className="mt-3 text-white/60 text-sm italic">💡 {daInfo.palette_advice}</p>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <div className="flex flex-wrap gap-2 justify-end">
                              {daInfo.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-sm">{tag}</span>
                              ))}
                            </div>
                            {/* Color swatches */}
                            <div className="flex gap-1.5 mt-3">
                              {result.colors.slice(0, 5).map((c, i) => (
                                <div key={i} className="w-8 h-8 rounded-full ring-2 ring-white/30 shadow" style={{ backgroundColor: c.hex }} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <p className="mt-4 text-white/40 font-mono text-xs">{urlParam}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* ── SEO ── */}
                <section className="bg-elevated/60 backdrop-blur-xl border border-subtle rounded-3xl p-7 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-forge-apple/10 rounded-xl"><Globe size={18} className="text-forge-apple" /></div>
                    <div>
                      <h2 className="text-lg font-bold text-ink-primary">SEO & Performance</h2>
                      <p className="text-xs text-ink-muted">Référencement, métadonnées et temps de réponse</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-elevated rounded-xl border border-subtle">
                      <span className="text-xs font-mono font-bold text-ink-secondary">{result.seo.response_time_ms}ms</span>
                      <span className={`w-2 h-2 rounded-full ${result.seo.response_time_ms < 500 ? "bg-status-completed" : result.seo.response_time_ms < 1500 ? "bg-status-processing" : "bg-status-failed"}`} />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="p-4 bg-white/50 rounded-2xl border border-subtle">
                      <p className="text-[10px] font-mono text-ink-muted mb-1 uppercase tracking-wider">Titre</p>
                      <p className="text-sm font-semibold text-ink-primary truncate">{result.seo.title || "—"}</p>
                      {result.seo.title && <p className={`text-[10px] mt-1 font-mono ${result.seo.title.length > 60 ? "text-status-failed" : "text-status-completed"}`}>{result.seo.title.length} car. (recommandé: 50–60)</p>}
                    </div>
                    <div className="p-4 bg-white/50 rounded-2xl border border-subtle">
                      <p className="text-[10px] font-mono text-ink-muted mb-1 uppercase tracking-wider">Méta description</p>
                      <p className="text-sm font-semibold text-ink-primary truncate">{result.seo.description || "—"}</p>
                      {result.seo.description && <p className={`text-[10px] mt-1 font-mono ${result.seo.description.length > 160 ? "text-status-failed" : "text-status-completed"}`}>{result.seo.description.length} car. (recommandé: 120–160)</p>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <CheckBadge ok={result.seo.has_viewport} label="Viewport" />
                    <CheckBadge ok={!!result.seo.og_title} label="OG Title" />
                    <CheckBadge ok={!!result.seo.og_description} label="OG Description" />
                    <CheckBadge ok={!!result.seo.og_image} label="OG Image" />
                    <CheckBadge ok={!!result.seo.canonical} label="Canonical" />
                    <CheckBadge ok={result.seo.h1_count === 1} label={`H1 unique (${result.seo.h1_count})`} />
                    <CheckBadge ok={result.seo.has_robots} label="Robots meta" />
                  </div>
                </section>

                {/* ── Colors ── */}
                <section className="bg-elevated/60 backdrop-blur-xl border border-subtle rounded-3xl p-7 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-forge-violet/10 rounded-xl"><Palette size={18} className="text-forge-violet" /></div>
                    <div>
                      <h2 className="text-lg font-bold text-ink-primary">Palette Dominante</h2>
                      <p className="text-xs text-ink-muted">{result.colors.length} couleurs principales identifiées</p>
                    </div>
                  </div>

                  {result.colors.length > 0 ? (
                    <>
                      {/* Swatch band */}
                      <div className="h-8 rounded-xl overflow-hidden flex mb-5 shadow-sm">
                        {result.colors.map((c, i) => (
                          <div key={i} className="flex-1" style={{ backgroundColor: c.hex }} title={c.hex} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {result.colors.slice(0, 3).map((c: ColorInfo, idx: number) => {
                          const roleInfo = ROLE_LABELS[c.role];
                          const isCopied = copiedHex === c.hex;
                          return (
                            <motion.button key={idx} whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                              onClick={() => copyToClipboard(c.hex)}
                              className="group flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-forge-violet/40 bg-white hover:shadow-md hover:border-forge-violet/80 transition-all text-left">
                              <div className="w-10 h-10 rounded-xl shadow-sm flex-shrink-0 ring-1 ring-black/5" style={{ backgroundColor: c.hex }} />
                              <div>
                                <p className="text-sm font-mono font-bold text-ink-primary uppercase">{c.hex}</p>
                                {roleInfo && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${roleInfo.color}`}>{roleInfo.label}</span>}
                              </div>
                              <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                {isCopied ? <CheckCheck size={14} className="text-status-completed" /> : <Copy size={14} className="text-ink-muted" />}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-ink-muted text-sm">Aucune couleur dominante détectée (site peut utiliser des images ou SVG pour ses couleurs).</p>
                  )}
                </section>

                {/* ── Color Harmony Panel ── */}
                <ColorHarmonyPanel detectedColors={result.colors} />

                {/* ── Accessibility ── */}
                <section className="bg-elevated/60 backdrop-blur-xl border border-subtle rounded-3xl p-7 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-status-processing/10 rounded-xl"><Shield size={18} className="text-status-processing" /></div>
                    <div>
                      <h2 className="text-lg font-bold text-ink-primary">Accessibilité</h2>
                      <p className="text-xs text-ink-muted">WCAG 2.1 · Contraste · Attributs HTML</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <StatCard icon={Eye} value={result.accessibility.images_with_alt} label="Images avec alt" color="text-status-completed" />
                    <StatCard icon={ImageIcon} value={result.accessibility.images_without_alt} label="Images sans alt" color={result.accessibility.images_without_alt > 0 ? "text-status-failed" : "text-status-completed"} />
                    <StatCard icon={Globe} value={result.accessibility.has_lang ? "✓" : "✗"} label="Attribut lang" color={result.accessibility.has_lang ? "text-status-completed" : "text-status-failed"} />
                    <StatCard icon={MousePointer} value={result.accessibility.has_skip_link ? "✓" : "✗"} label="Lien d'évitement" color={result.accessibility.has_skip_link ? "text-status-completed" : "text-ink-muted"} />
                  </div>

                  {result.accessibility.color_contrasts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Ratios de contraste (WCAG)</p>
                      <div className="space-y-2">
                        {result.accessibility.color_contrasts.map((contrast, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-subtle">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md ring-1 ring-black/10 shadow" style={{ backgroundColor: contrast.fg }} />
                              <span className="text-ink-muted text-xs">sur</span>
                              <div className="w-6 h-6 rounded-md ring-1 ring-black/10 shadow" style={{ backgroundColor: contrast.bg }} />
                            </div>
                            <span className="font-mono text-xs font-bold text-ink-primary">{contrast.ratio}:1</span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${contrast.level.includes("✓") ? "bg-status-completed/10 text-status-completed" : contrast.level === "AA Large" ? "bg-status-processing/10 text-status-processing" : "bg-status-failed/10 text-status-failed"}`}>
                              {contrast.level}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                {/* ── Fonts ── */}
                <section className="bg-elevated/60 backdrop-blur-xl border border-subtle rounded-3xl p-7 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-forge-cyan/10 rounded-xl"><Type size={18} className="text-forge-cyan" /></div>
                    <div>
                      <h2 className="text-lg font-bold text-ink-primary">Typographies</h2>
                      <p className="text-xs text-ink-muted">{result.fonts.length} police(s) identifiée(s)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.fonts.map((font: FontInfo, idx: number) => {
                      const roleInfo = ROLE_LABELS[font.role];
                      const sizes: Record<string, string> = { heading: "text-3xl", body: "text-base", monospace: "text-sm font-mono", ui: "text-sm" };
                      return (
                        <div key={idx} className="p-5 rounded-2xl bg-white border border-subtle hover:border-forge-cyan/30 transition-colors shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-ink-primary text-sm">{font.name}</p>
                              {roleInfo && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${roleInfo.color}`}>{roleInfo.label}</span>}
                            </div>
                            {font.google_fonts_url && (
                              <a href={font.google_fonts_url} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-forge-apple underline underline-offset-2 hover:text-forge-violet transition-colors">
                                Google Fonts ↗
                              </a>
                            )}
                          </div>
                          <p className={`text-ink-primary leading-snug truncate ${sizes[font.role] || "text-base"}`} style={{ fontFamily: font.name }}>
                            {font.role === "heading" ? "Le renard saute par-dessus le chien." : "The quick brown fox jumps over the lazy dog."}
                          </p>
                          <p className="text-[10px] font-mono text-ink-muted mt-2">Graisses : {font.weights.join(", ")}</p>
                        </div>
                      );
                    })}
                    {!result.fonts.length && <p className="text-ink-muted text-sm col-span-full">Aucune police personnalisée détectée.</p>}
                  </div>
                </section>




              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* History Drawer */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[350px] bg-white border-l border-subtle shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-subtle">
                <h2 className="text-lg font-bold text-ink-primary flex items-center gap-2">
                  <History size={18} /> Historique
                </h2>
                <button 
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-2 hover:bg-elevated rounded-full transition-colors text-ink-muted hover:text-ink-primary"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {history.length > 0 ? (
                  <div className="space-y-2">
                    {history.map((h, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          addHistory(h);
                          setIsHistoryOpen(false);
                          router.push(`/analyse?url=${encodeURIComponent(h)}`);
                        }}
                        className="w-full text-left px-4 py-3 bg-elevated/50 hover:bg-elevated rounded-xl border border-subtle hover:border-black/20 transition-all group"
                      >
                        <p className="text-sm font-medium text-ink-primary truncate">{h.replace(/^https?:\/\//, '')}</p>
                        <p className="text-[10px] font-mono text-ink-muted mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Analyser à nouveau →</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-ink-muted">Aucune analyse récente.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={() => setIsAuthModalOpen(false)} 
      />
    </div>
  );
}

export default function Analyse() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-void items-center justify-center">
        <Loader2 size={40} className="text-forge-violet animate-spin" />
      </div>
    }>
      <AnalysisContent />
    </Suspense>
  );
}
