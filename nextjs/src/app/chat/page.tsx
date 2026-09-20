"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import toast from "react-hot-toast";

interface Message { id: string; role: string; content: string; }
interface Session { id: string; title: string; }

export default function ChatPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    authFetch("/api/sessions").then(r => r.json()).then(d => {
      setSessions(d.sessions || []);
      if (d.sessions?.length > 0) setActiveSession(d.sessions[0].id);
    });
  }, [user]);

  useEffect(() => {
    if (!activeSession) return;
    authFetch(`/api/messages?session_id=${activeSession}`).then(r => r.json()).then(d => setMessages(d.messages || []));
  }, [activeSession]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function createSession() {
    const res = await authFetch("/api/sessions", { method: "POST", body: JSON.stringify({ title: "New Session" }) });
    const data = await res.json();
    if (data.session) { setSessions(prev => [data.session, ...prev]); setActiveSession(data.session.id); setMessages([]); }
  }

  async function deleteSession(sessionId: string) {
    if (!confirm("Delete this session?")) return;
    await authFetch("/api/sessions", { method: "DELETE", body: JSON.stringify({ session_id: sessionId }) });
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSession === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      setActiveSession(remaining.length > 0 ? remaining[0].id : null);
      setMessages([]);
    }
  }

  async function sendMessage() {
    if (!input.trim() || sending || !activeSession) return;
    const userMsg = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput(""); setSending(true);
    try {
      const res = await authFetch("/api/chat", {
        method: "POST", body: JSON.stringify({ session_id: activeSession, content: input }),
      });
      const data = await res.json();
      if (data.reply) setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: data.reply }]);
      else toast.error("Failed to get response");
    } catch { toast.error("Failed to get response"); }
    setSending(false);
  }

  if (!user) return (
    <div className="min-h-screen bg-neo-white flex items-center justify-center">
      <div className="neo-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Login Required</h2>
        <p className="font-medium mb-4">Please login to use the AI chat.</p>
        <Link href="/login"><button className="neo-btn neo-btn-primary">LOGIN</button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neo-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-20">
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
          <div className="w-full lg:w-64 flex-shrink-0">
            <button onClick={createSession} className="neo-btn neo-btn-primary w-full flex items-center justify-center gap-2 mb-4">
              <Plus className="w-4 h-4" />New Session
            </button>
            <div className="space-y-2 overflow-y-auto max-h-[30vh] lg:max-h-none">
              {sessions.map(s => (
                <div key={s.id} className={`flex items-center border-3 border-neo-black ${activeSession === s.id ? "bg-neo-black text-neo-yellow" : "bg-white hover:bg-neo-yellow/30"}`}>
                  <button onClick={() => setActiveSession(s.id)} className="flex-1 text-left px-4 py-3 font-semibold uppercase text-sm truncate">
                    {s.title}
                  </button>
                  <button onClick={() => deleteSession(s.id)} className="px-3 py-3 hover:text-neo-pink transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 neo-card flex flex-col">
            <div className="p-4 border-b-3 border-neo-black font-bold uppercase">Nesti AI Chat</div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && <p className="text-center text-neo-black/50 font-medium mt-8">Ask me anything about web security.</p>}
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-3 font-medium text-sm border-3 border-neo-black ${m.role === "user" ? "bg-neo-blue text-white" : "bg-white"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && <div className="flex justify-start"><div className="bg-white border-3 border-neo-black px-4 py-3 text-sm font-medium flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Thinking...</div></div>}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t-3 border-neo-black flex gap-3">
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Type your message..." className="flex-1 neo-input" disabled={sending} />
              <button onClick={sendMessage} disabled={sending} className="neo-btn neo-btn-primary">SEND</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
