import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-subtle relative"
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-ink-muted hover:text-ink-primary hover:bg-elevated rounded-full transition-colors"
              >
                <X size={18} />
              </button>

              <div className="p-8">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-ink-primary mb-2">
                    {isLogin ? "Bon retour !" : "Créer un compte"}
                  </h2>
                  <p className="text-sm text-ink-muted">
                    {isLogin
                      ? "Connectez-vous pour retrouver votre historique."
                      : "Rejoignez LAPIE Studio pour sauvegarder vos analyses."}
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-3 bg-status-failed/10 border border-status-failed/20 rounded-xl flex items-start gap-2 text-status-failed">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1.5 uppercase tracking-wider">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-elevated border border-subtle rounded-xl text-sm focus:outline-none focus:border-forge-violet/50 focus:ring-1 focus:ring-forge-violet/50 transition-all"
                      placeholder="vous@exemple.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink-secondary mb-1.5 uppercase tracking-wider">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-elevated border border-subtle rounded-xl text-sm focus:outline-none focus:border-forge-violet/50 focus:ring-1 focus:ring-forge-violet/50 transition-all"
                      placeholder="••••••••"
                      minLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-ink-primary text-white font-medium rounded-xl text-sm hover:bg-ink-primary/90 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 mt-6 shadow-md"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {isLogin ? "Se connecter" : "S'inscrire"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setError(null);
                    }}
                    className="text-sm text-ink-muted hover:text-ink-primary transition-colors"
                  >
                    {isLogin
                      ? "Pas encore de compte ? S'inscrire"
                      : "Déjà un compte ? Se connecter"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
