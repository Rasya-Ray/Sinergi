"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Plus, Pause, Play, Trash2, Loader2, Globe, Clock, AlertTriangle, Calendar } from "lucide-react";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import toast from "react-hot-toast";

interface Monitor { id: string; target_url: string; check_type: string; schedule: string; schedule_type: string; schedule_hour: number; schedule_minute: number; schedule_day: number; schedule_weekday: number; status: string; last_run: string | null; next_run: string | null; created_at: string; }
interface HistoryEntry { id: string; scan_data: any; dns_data: any; tls_data: any; changes_detected: any[]; status: string; created_at: string; }

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function MonitoringPage() {
  const { user, loading: authLoading } = useAuth();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedMonitor, setExpandedMonitor] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [schedType, setSchedType] = useState("daily");
  const [schedHour, setSchedHour] = useState(0);
  const [schedMinute, setSchedMinute] = useState(0);
  const [schedDay, setSchedDay] = useState(1);
  const [schedWeekday, setSchedWeekday] = useState(1);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    authFetch("/api/monitoring").then(r => r.json()).then(d => { setMonitors(d.monitors || []); setLoading(false); }).catch(() => setLoading(false));
  }, [user, authLoading]);

  async function createMonitor() {
    if (!newUrl) return;
    setCreating(true);
    try {
      const res = await authFetch("/api/monitoring", { method: "POST", body: JSON.stringify({ target_url: newUrl, check_type: "full", schedule_type: schedType, schedule_hour: schedHour, schedule_minute: schedMinute, schedule_day: schedDay, schedule_weekday: schedWeekday }) });
      const data = await res.json();
      if (data.monitor) { setMonitors(prev => [data.monitor, ...prev]); setNewUrl(""); setShowForm(false); }
    } catch {}
    setCreating(false);
  }

  async function toggleMonitor(id: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try { await authFetch("/api/monitoring", { method: "PUT", body: JSON.stringify({ id, status: newStatus }) }); setMonitors(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m)); } catch {}
  }

  async function deleteMonitor(id: string) {
    try {
      const res = await authFetch(`/api/monitoring?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Monitor deleted");
        setMonitors(prev => prev.filter(m => m.id !== id));
      } else {
        toast.error("Failed to delete monitor");
      }
    } catch { toast.error("Failed to delete monitor"); }
  }

  async function loadHistory(monitorId: string) {
    if (expandedMonitor === monitorId) { setExpandedMonitor(null); return; }
    setExpandedMonitor(monitorId); setHistoryLoading(true);
    try { const res = await authFetch(`/api/monitoring/history?monitor_id=${monitorId}`); const data = await res.json(); setHistory(data.history || []); } catch { setHistory([]); }
    setHistoryLoading(false);
  }

  if (authLoading || loading) return <div className="min-h-screen bg-neo-white flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!user) return (
    <div className="min-h-screen bg-neo-white flex items-center justify-center">
      <div className="neo-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Login Required</h2>
        <p className="font-medium mb-4">Please login to use monitoring.</p>
        <Link href="/login"><button className="neo-btn neo-btn-primary">LOGIN</button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neo-white">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4"><span className="bg-neo-yellow px-3 border-3 border-neo-black inline-block rotate-[-1deg]">Security</span> Monitoring</h1>
            <p className="text-lg text-neo-black/70 font-medium">Automated recurring scans for your websites.</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="neo-btn neo-btn-primary flex items-center gap-2"><Plus className="w-5 h-5" /> Add Monitor</button>
        </motion.div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="neo-card p-6 mb-6">
              <h3 className="font-bold uppercase mb-4">New Monitor</h3>
              <div className="space-y-4">
                <input type="text" value={newUrl} onChange={e => setNewUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && createMonitor()} placeholder="e.g. example.com" className="w-full neo-input font-mono" />
                <div>
                  <label className="text-sm font-bold uppercase mb-2 block">Schedule</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[["hourly", "Hourly"], ["every_6h", "Every 6h"], ["every_12h", "Every 12h"], ["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["yearly", "Yearly"]].map(([v, l]) => (
                      <button key={v} onClick={() => setSchedType(v)} className={`px-3 py-2 text-sm font-semibold uppercase border-3 border-neo-black ${schedType === v ? "bg-neo-black text-neo-yellow" : "bg-white hover:bg-neo-yellow/30"}`}>{l}</button>
                    ))}
                  </div>
                </div>
                {schedType !== "hourly" && (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm font-bold uppercase">Time</label>
                    <select value={schedHour} onChange={e => setSchedHour(Number(e.target.value))} className="border-3 border-neo-black px-3 py-2 font-mono outline-none bg-white">
                      {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}</option>)}
                    </select>
                    <span className="font-bold">:</span>
                    <select value={schedMinute} onChange={e => setSchedMinute(Number(e.target.value))} className="border-3 border-neo-black px-3 py-2 font-mono outline-none bg-white">
                      {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
                    </select>
                  </div>
                )}
                {schedType === "hourly" && <div className="text-sm font-medium text-neo-black/60">Runs every hour at minute {String(schedMinute).padStart(2, "0")}</div>}
                {schedType === "weekly" && (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm font-bold uppercase">Day</label>
                    <select value={schedWeekday} onChange={e => setSchedWeekday(Number(e.target.value))} className="border-3 border-neo-black px-3 py-2 font-medium outline-none bg-white">
                      {weekdays.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}
                {(schedType === "monthly" || schedType === "yearly") && (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm font-bold uppercase">Day of Month</label>
                    <select value={schedDay} onChange={e => setSchedDay(Number(e.target.value))} className="border-3 border-neo-black px-3 py-2 font-mono outline-none bg-white">
                      {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={createMonitor} disabled={creating} className="neo-btn neo-btn-primary px-6">{creating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create"}</button>
                  <button onClick={() => setShowForm(false)} className="neo-btn px-6">Cancel</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {monitors.length === 0 ? (
          <div className="neo-card p-12 text-center">
            <Eye className="w-12 h-12 mx-auto mb-4 text-neo-black/30" />
            <h3 className="text-xl font-bold mb-2">No Monitors</h3>
            <p className="font-medium text-neo-black/60">Add a monitor to start automated security scans.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {monitors.map((m, i) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="neo-card">
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 flex-shrink-0" />
                      <div>
                        <span className="font-mono font-bold">{m.target_url}</span>
                        <div className="text-sm text-neo-black/50 font-medium flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{m.schedule || m.schedule_type}</span>
                          {m.last_run && <span>· Last: {new Date(m.last_run).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`neo-badge ${m.status === "active" ? "bg-neo-green text-white" : "bg-neo-orange text-white"}`}>{m.status}</span>
                      <button onClick={() => loadHistory(m.id)} className="p-2 border-2 border-neo-black bg-white hover:bg-neo-yellow"><Clock className="w-4 h-4" /></button>
                      <button onClick={() => toggleMonitor(m.id, m.status)} className="p-2 border-2 border-neo-black bg-white hover:bg-neo-yellow">{m.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
                      <button onClick={() => deleteMonitor(m.id)} className="p-2 border-2 border-neo-black bg-white hover:bg-neo-pink hover:text-white"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
                <AnimatePresence>
                  {expandedMonitor === m.id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t-4 border-neo-black">
                      <div className="p-6">
                        <h4 className="font-bold uppercase mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> History ({history.length})</h4>
                        {historyLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : history.length === 0 ? <p className="text-neo-black/50 font-medium">No history yet.</p> : (
                          <div className="space-y-4">
                            {history.map(h => (
                              <div key={h.id} className="border-3 border-neo-black p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-mono text-sm">{new Date(h.created_at).toLocaleString()}</span>
                                  <span className={`neo-badge ${h.status === "completed" ? "bg-neo-green text-white" : "bg-neo-pink text-white"}`}>{h.status}</span>
                                </div>
                                {h.changes_detected?.length > 0 && (
                                  <div className="mt-2">
                                    <span className="font-bold text-sm uppercase">Changes Detected</span>
                                    {h.changes_detected.map((c: any, j: number) => (
                                      <div key={j} className="flex items-center gap-2 mt-1 text-sm"><AlertTriangle className="w-3 h-3 text-neo-orange" /><span className="font-medium">{c.description}</span></div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
