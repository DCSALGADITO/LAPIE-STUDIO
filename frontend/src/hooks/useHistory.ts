import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";

export function useHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Fetch history when user changes
  useEffect(() => {
    const fetchHistory = async () => {
      if (user) {
        // Fetch from Supabase
        const { data, error } = await supabase
          .from("user_analyses")
          .select("url")
          .order("created_at", { ascending: false })
          .limit(20);
        
        if (!error && data) {
          // Extract unique URLs
          const urls = Array.from(new Set(data.map(d => d.url))).slice(0, 5);
          setHistory(urls);
        }
      } else {
        // Fetch from localStorage
        const saved = localStorage.getItem("lapie_history");
        if (saved) {
          try {
            setHistory(JSON.parse(saved));
          } catch (e) {}
        } else {
          setHistory([]);
        }
      }
    };

    fetchHistory();
  }, [user, supabase]);

  const addHistory = async (url: string) => {
    const newHistory = [url, ...history.filter(h => h !== url)].slice(0, 5);
    setHistory(newHistory); // Optimistic UI update

    if (user) {
      // Save to Supabase
      await supabase.from("user_analyses").insert([
        { url, user_id: user.id }
      ]);
    } else {
      // Save to localStorage
      localStorage.setItem("lapie_history", JSON.stringify(newHistory));
    }
  };

  return { history, addHistory, user, supabase };
}
