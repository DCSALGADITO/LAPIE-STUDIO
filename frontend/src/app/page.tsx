"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Server, GitBranch, Layers, Cpu, Inbox, Bird, Search, ArrowRight, User, History, X, LogOut } from "lucide-react";
import { UploadZone } from "@/components/UploadZone";
import { JobCard } from "@/components/JobCard";
import { ResultViewer } from "@/components/ResultViewer";
import { AuthModal } from "@/components/AuthModal";
import { useJobQueue } from "@/hooks/useJobQueue";
import { useHistory } from "@/hooks/useHistory";
import type { FrontendJob } from "@/hooks/useJobQueue";
import { useRouter } from "next/navigation";

export default function Accueil() {
  const router = useRouter();
  const { jobs, submitJob, updateJob, removeJob } = useJobQueue();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const completedCount = jobs.filter((j: FrontendJob) => j.status === "completed").length;
  const selectedJob = jobs.find((j: FrontendJob) => j.id === selectedJobId) ?? null;

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { history, addHistory, user, supabase } = useHistory();

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
    }

    addHistory(cleanUrl);
    router.push(`/analyse?url=${encodeURIComponent(cleanUrl)}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-void text-ink-primary font-sans selection:bg-forge-apple/30 relative">
      {/* Abstract Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-forge-violet/20 rounded-full blur-[120px] mix-blend-multiply" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[35%] bg-forge-cyan/20 rounded-full blur-[100px] mix-blend-multiply" />
      </div>

      {/* Header Monopage */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between px-8 py-5 border-b border-subtle bg-white/40 backdrop-blur-3xl z-20 sticky top-0 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <Bird size={28} className="text-ink-primary" fill="currentColor" />
          <div>
            <p className="text-[16px] font-bold text-ink-primary tracking-tight leading-none">
              LAPIE Studio
            </p>
          </div>
        </div>

        {/* Stats pills (exactement comme demandé) */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 px-4 py-1.5 bg-transparent border border-black rounded-full text-black text-xs font-semibold hover:bg-black/5 transition-colors"
          >
            <History size={14} />
            Analyses effectuées
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-elevated/50 backdrop-blur-md rounded-full border border-subtle hover:bg-elevated transition-colors cursor-default">
            <Server size={12} className="text-ink-muted" />
            <span className="text-[11px] font-medium text-ink-secondary">API</span>
            <span className="w-2 h-2 rounded-full bg-status-completed shadow-[0_0_8px_rgba(50,215,75,0.6)] animate-pulse"></span>
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
      </motion.header>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-y-auto space-y-12 z-10 scroll-smooth">
        
        {/* 1. Analyseur UX/UI (Barre de recherche) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto w-full text-center space-y-6 pt-10"
        >
          <div className="inline-flex items-center justify-center mb-2">
            <Bird size={48} className="text-ink-primary" fill="currentColor" />
          </div>
          <h1 className="text-5xl font-bold text-ink-primary tracking-tight">
            Analyseur <span className="text-gradient">UX/UI</span>
          </h1>
          <p className="text-ink-secondary text-lg max-w-xl mx-auto">
            Entrez l'URL d'un site web pour extraire sa palette de couleurs, ses typographies et ses images en quelques secondes.
          </p>

          <form onSubmit={handleAnalyze} className="relative max-w-2xl mx-auto mt-8">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search size={20} className="text-ink-muted" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://apple.com"
              className="w-full bg-panel backdrop-blur-xl border border-subtle text-ink-primary text-lg rounded-2xl py-4 pl-14 pr-32 focus:outline-none focus:ring-2 focus:ring-forge-apple/50 focus:border-forge-apple transition-all shadow-apple placeholder-ink-muted"
            />
            <div className="absolute inset-y-2 right-2">
              <button
                type="submit"
                disabled={!url}
                className="h-full px-6 bg-forge-apple hover:bg-forge-apple/90 disabled:bg-elevated disabled:text-ink-muted text-white font-medium rounded-xl flex items-center gap-2 transition-colors"
              >
                Analyser <ArrowRight size={18} />
              </button>
            </div>
          </form>

          {history.length > 0 && (
            <div className="max-w-2xl mx-auto mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-ink-muted mr-2">Récentes :</span>
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    addHistory(h);
                    router.push(`/analyse?url=${encodeURIComponent(h)}`);
                  }}
                  className="px-3 py-1.5 bg-elevated rounded-lg text-xs font-mono text-ink-secondary border border-subtle hover:bg-white/50 transition-colors"
                >
                  {h.replace(/^https?:\/\//, '')}
                </button>
              ))}
            </div>
          )}
        </motion.section>

        {/* 2. Zones de traitement (SVG / Remove BG) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl mx-auto w-full"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <UploadZone
              mode="vectorize"
              onUpload={(files, params) => files.forEach(f => submitJob(f, "vectorize", params))}
            />
            <UploadZone
              mode="remove_bg"
              onUpload={(files, params) => files.forEach(f => submitJob(f, "remove_bg", params))}
            />
          </div>
        </motion.section>

        {/* Job queue */}
        {jobs.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="max-w-5xl mx-auto w-full pt-12 pb-24"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-subtle/50">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-ink-primary tracking-wide">
                  File de traitement
                </h2>
                <span className="text-[11px] font-mono font-bold text-ink-primary px-2.5 py-1 bg-white/10 rounded-full">
                  {jobs.length} JOB{jobs.length > 1 ? "S" : ""}
                </span>
              </div>
              {completedCount > 0 && (
                <button
                  onClick={() =>
                    jobs
                      .filter((j: FrontendJob) => j.status === "completed" || j.status === "failed")
                      .forEach((j: FrontendJob) => removeJob(j.id))
                  }
                  className="text-xs font-medium text-ink-muted hover:text-white px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
                >
                  Effacer terminés
                </button>
              )}
            </div>

            <AnimatePresence mode="popLayout">
              <div className="space-y-4">
                {jobs.map((job: FrontendJob) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onUpdate={updateJob}
                    onRemove={removeJob}
                    onSelect={(id) => setSelectedJobId(id)}
                  />
                ))}
              </div>
            </AnimatePresence>
          </motion.section>
        )}
      </main>

      {/* Result Viewer Modal */}
      <AnimatePresence>
        {selectedJobId && selectedJob && selectedJob.status === "completed" && (
          <ResultViewer
            key={selectedJobId}
            job={selectedJob}
            onClose={() => setSelectedJobId(null)}
          />
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
