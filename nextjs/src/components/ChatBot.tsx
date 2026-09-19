"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { authFetch } from "@/lib/api";
import toast from "react-hot-toast";

export default function ChatBot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: "Hi! I'm Nesti, your AI security assistant. Ask me anything about web security!" }]);
    }
  }, [open]);

  async function send() {
    if (!input.trim() || sending) return;
    if (!user) { toast.error("Please login first"); return; }

    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput(""); setSending(true);

    try {
      let sid = sessionId;
      if (!sid) {
        const res = await authFetch("/api/sessions", { method: "POST", body: JSON.stringify({ title: "Quick Chat" }) });
        const data = await res.json();
        sid = data.session?.id;
        setSessionId(sid);
      }

      const res = await authFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ session_id: sid, content: input }),
      });
      const data = await res.json();
      if (data.reply) setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      else setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
    }
    setSending(false);
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 right-4 sm:right-6 w-[340px] sm:w-[380px] neo-card z-50 flex flex-col overflow-hidden">
            <div className="bg-neo-blue p-4 border-b-3 border-neo-black flex items-center justify-between">
              <span className="font-bold uppercase text-white">Nesti AI Chat</span>
              <button onClick={() => setOpen(false)} className="text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 h-[300px] bg-white">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 text-sm font-medium border-2 border-neo-black ${m.role === "user" ? "bg-neo-blue text-white" : "bg-neo-yellow"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && <div className="flex justify-start"><div className="bg-neo-yellow border-2 border-neo-black px-3 py-2 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />...</div></div>}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t-3 border-neo-black bg-white flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
                placeholder={user ? "Type your message..." : "Login first..."} className="flex-1 border-2 border-neo-black px-3 py-2 text-sm outline-none" disabled={sending} />
              <button onClick={send} disabled={sending} className="bg-neo-black text-neo-yellow p-2 border-2 border-neo-black">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-4 sm:right-6 w-14 h-14 bg-neo-blue border-3 border-neo-black shadow-[4px_4px_0_var(--color-neo-black)] flex items-center justify-center z-50">
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>
    </>
  );
}
