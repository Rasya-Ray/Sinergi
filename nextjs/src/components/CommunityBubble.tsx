"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { authFetch } from "@/lib/api";
import toast from "react-hot-toast";

interface CommunityMsg {
  id: number;
  user_name: string;
  message: string;
  created_at: string;
}

export default function CommunityBubble() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CommunityMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  async function loadMessages() {
    try {
      const res = await fetch("/api/community");
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch {}
    setLoading(false);
  }

  async function send() {
    if (!input.trim() || sending) return;
    if (!user) { toast.error("Login dulu untuk chat"); return; }

    setSending(true);
    const msg = input.trim();
    setInput("");

    try {
      const res = await authFetch("/api/community", {
        method: "POST",
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      if (data.success) {
        await loadMessages();
      } else {
        toast.error(data.error || "Gagal mengirim");
      }
    } catch {
      toast.error("Gagal mengirim pesan");
    }
    setSending(false);
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 right-4 sm:right-6 w-[340px] sm:w-[380px] neo-card z-50 flex flex-col overflow-hidden"
            style={{ height: "450px" }}
          >
            <div className="bg-neo-green p-4 border-b-3 border-neo-black flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-white" />
                <span className="font-bold uppercase text-white">Community</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <button onClick={() => setOpen(false)} className="text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-white min-h-0">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-neo-black/30" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-neo-black/30 font-bold uppercase text-sm text-center">Belum ada pesan. Mulai chat!</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[11px] uppercase text-neo-purple">{m.user_name}</span>
                      <span className="text-[10px] text-neo-black/30 font-mono">
                        {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="bg-neo-black/5 border-2 border-neo-black/10 px-3 py-2 text-sm font-medium break-words overflow-wrap-anywhere whitespace-pre-wrap">
                      {m.message}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t-3 border-neo-black bg-white flex gap-2 flex-shrink-0">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                placeholder={user ? "Ketik pesan..." : "Login dulu..."}
                className="flex-1 border-2 border-neo-black px-3 py-2 text-sm font-medium outline-none"
                disabled={sending}
              />
              <button onClick={send} disabled={sending || !input.trim()}
                className="bg-neo-black text-neo-yellow p-2 border-2 border-neo-black hover:bg-neo-purple transition-colors">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-4 sm:right-6 w-14 h-14 bg-neo-green border-3 border-neo-black shadow-[4px_4px_0_var(--color-neo-black)] flex items-center justify-center z-50"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>
    </>
  );
}
