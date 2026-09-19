"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, ChevronDown, ChevronUp, Zap, Clock, AlertTriangle } from "lucide-react";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

interface Scan {
  id: string;
  target_url: string;
  findings: any[];
  technologies: any;
  status: string;
  created_at: string;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedScan, setExpandedScan] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    authFetch("/api/history").then(r => r.json()).then(d => { setScans(d.scans || []); setLoading(false); }).catch(() => setLoading(false));
  }, [user]);

  function getRiskLevel(findings: any[]): string {
    if (!findings || findings.length === 0) return "low";
    const hasHigh = findings.some((f: any) => f.severity === "HIGH" || f.severity === "CRITICAL");
    const hasMedium = findings.some((f: any) => f.severity === "MEDIUM");
    if (hasHigh) return "high";
    if (hasMedium) return "medium";
    return "low";
  }

  function getSeverityCounts(findings: any[]) {
    const counts = { high: 0, medium: 0, low: 0 };
    (findings || []).forEach((f: any) => {
      const sev = (f.severity || "low").toLowerCase();
      if (sev === "high" || sev === "critical") counts.high++;
      else if (sev === "medium") counts.medium++;
      else counts.low++;
    });
    return counts;
  }

  if (loading) return <div className="min-h-screen bg-neo-white flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!user) return (
    <div className="min-h-screen bg-neo-white flex items-center justify-center">
      <div className="neo-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Login Required</h2>
        <p className="font-medium mb-4">Please login to view scan history.</p>
        <Link href="/login"><button className="neo-btn neo-btn-primary">LOGIN</button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neo-white">
      <main className="max-w-7xl mx-auto px-6 pt-8 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-neo-yellow px-3 border-3 border-neo-black inline-block rotate-[-1deg]">Scan</span> History
          </h1>
          <p className="text-lg text-neo-black/70 font-medium">Your previous security scan results. Click to expand details.</p>
        </motion.div>

        {scans.length === 0 ? (
          <div className="neo-card p-12 text-center">
            <Search className="w-12 h-12 mx-auto mb-4 text-neo-black/30" />
            <h3 className="text-xl font-bold mb-2">No Scans Yet</h3>
            <p className="font-medium text-neo-black/60 mb-4">Run your first security scan to see results here.</p>
            <Link href="/scan"><button className="neo-btn neo-btn-primary">START SCANNING</button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.map((s, i) => {
              const findings = s.findings || [];
              const risk = getRiskLevel(findings);
              const counts = getSeverityCounts(findings);
              const isExpanded = expandedScan === s.id;

              return (
                <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="neo-card overflow-hidden">
                  <button onClick={() => setExpandedScan(isExpanded ? null : s.id)}
                    className="w-full p-6 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-neo-purple border-2 border-neo-black flex items-center justify-center flex-shrink-0">
                          <Zap className="w-5 h-5 text-white" fill="white" />
                        </div>
                        <div>
                          <span className="font-mono font-bold">{s.target_url}</span>
                          <div className="text-sm text-neo-black/50 font-medium flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3" />
                            {new Date(s.created_at).toLocaleString()}
                            <span className="text-neo-black/30">·</span>
                            <span className="font-bold">{findings.length} findings</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2">
                          {counts.high > 0 && <span className="text-xs font-bold text-neo-pink">{counts.high}H</span>}
                          {counts.medium > 0 && <span className="text-xs font-bold text-neo-orange">{counts.medium}M</span>}
                          {counts.low > 0 && <span className="text-xs font-bold text-neo-green">{counts.low}L</span>}
                        </div>
                        <span className={`neo-badge severity-${risk}`}>{risk.toUpperCase()}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                        className="overflow-hidden border-t-3 border-neo-black">
                        <div className="p-6">
                          {findings.length === 0 ? (
                            <p className="text-neo-black/50 font-medium text-center py-4">No detailed findings recorded for this scan.</p>
                          ) : (
                            <div className="space-y-3">
                              <h4 className="font-bold uppercase text-sm mb-3">Findings ({findings.length})</h4>
                              {findings.map((f: any, j: number) => (
                                <div key={j} className="border-2 border-neo-black/20 p-4 bg-white">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`neo-badge severity-${(f.severity || "low").toLowerCase()}`}>{(f.severity || "LOW").toUpperCase()}</span>
                                      <span className="font-bold text-sm">{f.detail || f.type || f.finding || "Security finding"}</span>
                                    </div>
                                    {f.type && <span className="text-xs font-mono text-neo-black/40">{f.type}</span>}
                                  </div>
                                  {f.evidence && (
                                    <div className="mt-2 text-xs font-mono bg-neo-black/5 p-2 border border-neo-black/10">
                                      {f.evidence}
                                    </div>
                                  )}
                                  {f.recommendation && (
                                    <p className="mt-2 text-sm font-medium text-neo-black/60">
                                      <span className="font-bold uppercase text-xs">Fix: </span>{f.recommendation}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {s.technologies && Object.keys(s.technologies).length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-bold uppercase text-sm mb-2">Technologies Detected</h4>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(s.technologies).map(([k, v]: [string, any]) => (
                                  <span key={k} className="neo-badge bg-neo-blue/10 text-neo-black">{k}: {typeof v === "string" ? v : JSON.stringify(v)}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
