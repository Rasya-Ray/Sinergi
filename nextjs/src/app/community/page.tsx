"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { authFetch } from "@/lib/api";
import toast from "react-hot-toast";

interface CommunityMsg {
  id: number;
  user_name: string;
  message: string;
  created_at: string;
}

export default function CommunityPage() {
  const { user } = useAuth();
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
    <div className="min-h-screen bg-neo-white">
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-20 h-screen flex flex-col">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="neo-card p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neo-green border-3 border-neo-black flex items-center justify-center">
              <Users className="w-5 h-5 text-neo-black" />
            </div>
            <div>
              <h1 className="font-bold text-lg uppercase">Community Chat</h1>
              <p className="text-xs font-medium text-neo-black/50">Semua orang bisa lihat pesan di sini</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-neo-green rounded-full animate-pulse" />
            <span className="text-xs font-bold text-neo-black/50">LIVE</span>
          </div>
        </motion.div>

        {/* Messages */}
        <div ref={containerRef} className="flex-1 overflow-y-auto neo-card p-4 space-y-3 mb-4"
          style={{ scrollBehavior: "auto" }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-neo-black/30" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-neo-black/30 font-bold uppercase">Belum ada pesan. Mulai chat!</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-xs uppercase text-neo-purple">{m.user_name}</span>
                  <span className="text-[10px] text-neo-black/30 font-mono">
                    {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="bg-white border-2 border-neo-black px-3 py-2 text-sm font-medium max-w-full break-words overflow-hidden">
                  {m.message}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="neo-card p-3 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={user ? "Ketik pesan..." : "Login dulu..."}
            className="flex-1 neo-input text-sm"
            disabled={sending}
          />
          <button onClick={send} disabled={sending || !input.trim()}
            className="neo-btn neo-btn-primary flex items-center gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">KIRIM</span>
          </button>
        </div>
      </main>
    </div>
  );
}
