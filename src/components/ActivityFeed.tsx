"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Activity, ChevronRight, X } from "lucide-react";

interface FeedItem {
  id: string;
  projectId: string;
  projectName: string;
  projectMode: string | null;
  role: string;
  content: string;
  createdAt: string;
}

export default function ActivityFeed({ onSelectProject }: { onSelectProject: (id: string) => void }) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/activity");
      if (res.ok) {
        const j = await res.json();
        setFeed(j.feed ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchFeed();
    const t = setInterval(fetchFeed, 4000);
    return () => clearInterval(t);
  }, [fetchFeed]);

  const timeAgo = (iso: string) => {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Floating trigger button
  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-2.5 glass-panel rounded-full text-xs font-medium text-surface-300 hover:text-surface-100 hover:border-primary-500/40 transition-all shadow-2xl"
        title="Global activity feed"
      >
        <span className="relative flex h-2 w-2">
          {feed.length > 0 && (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
            </>
          )}
        </span>
        <Activity className="w-3.5 h-3.5" />
        <span>Live activity</span>
        {feed.length > 0 && <span className="text-primary-400 tabular-nums">{feed.length}</span>}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-96 max-w-full glass-heavy border-l border-surface-800 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary-400" />
                  <h3 className="font-semibold text-surface-100">Global activity</h3>
                </div>
                <button onClick={() => setOpen(false)} className="btn btn-ghost btn-icon">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
                  </div>
                ) : feed.length === 0 ? (
                  <div className="text-center py-12 text-surface-500 text-sm">
                    No activity yet. Create a project to see live agent messages.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {feed.map((item, i) => (
                      <motion.button
                        key={item.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i, 6) * 0.03 }}
                        onClick={() => { onSelectProject(item.projectId); setOpen(false); }}
                        className="w-full text-left p-3 rounded-lg hover:bg-surface-800/60 transition-colors border border-transparent hover:border-surface-700"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            item.projectMode === "greenfield" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                          }`}>
                            {item.projectName}
                          </span>
                          <span className="text-[10px] text-surface-600 tabular-nums">{timeAgo(item.createdAt)}</span>
                        </div>
                        <p className="text-xs text-surface-400 line-clamp-2 leading-relaxed">{item.content}</p>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-surface-600">
                          <ChevronRight className="w-2.5 h-2.5" />
                          Open project
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-5 py-3 border-t border-surface-800 text-[10px] text-surface-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 anim-pulse" />
                Refreshing every 4s
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
