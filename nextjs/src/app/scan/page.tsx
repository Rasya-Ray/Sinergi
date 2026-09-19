"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Shield, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ScanPage() {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);

  async function handleScan() {
    if (!user) { toast.error("Please login first"); return; }
    if (!url) { toast.error("Enter a URL to scan"); return; }
    setLoading(true);
    setResult(null);
    try {
      const domain = url.replace(/https?:\/\//, "").split("/")[0];
      const scanRes = await authFetch("/api/scan", {
        method: "POST",
        body: JSON.stringify({ url: domain }),
      });
      const scanData = await scanRes.json();

      if (scanData.error || !scanData.scan) {
        toast.error(scanData.error || "Scan failed");
        setLoading(false);
        return;
      }

      const analyzeRes = await authFetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ url: domain, scan: scanData.scan, dns: scanData.dns, tls: scanData.tls }),
      });
      const analyzed = await analyzeRes.json();

      if (analyzed.error) {
        toast.error(analyzed.error);
        setLoading(false);
        return;
      }

      setResult(analyzed);
      toast.success("Scan complete!");
    } catch { toast.error("Scan failed"); }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-neo-white">
      <main className="max-w-7xl mx-auto px-6 pt-8 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-neo-yellow px-3 border-3 border-neo-black inline-block rotate-[-1deg]">Security</span> Scan
          </h1>
          <p className="text-lg text-neo-black/70 font-medium">Enter a website URL to perform a full security analysis.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="neo-card p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder="e.g. example.com or https://example.com"
              className="flex-1 neo-input" />
            <button onClick={handleScan} disabled={loading} className="neo-btn neo-btn-primary flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Scanning...</> : "SCAN →"}
            </button>
          </div>
          {!user && <p className="text-sm font-medium mt-3 text-neo-black/50">Login required to run scans.</p>}
        </motion.div>

        <AnimatePresence>
          {result?.risk_explanation && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="neo-card p-6 mb-6">
              <h2 className="text-xl font-bold uppercase mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Risk Explanation
              </h2>
              <span className={`neo-badge severity-${result.risk_explanation.level}`}>{result.risk_explanation.level?.toUpperCase()}</span>
              <p className="font-medium mt-3 text-neo-black/70">{result.risk_explanation.meaning}</p>
              {result.risk_explanation.reasons?.length > 0 && (
                <div className="mt-4">
                  <span className="font-bold text-sm uppercase">Reasons</span>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm font-medium text-neo-black/70">
                    {result.risk_explanation.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {result.risk_explanation.priority?.length > 0 && (
                <div className="mt-4">
                  <span className="font-bold text-sm uppercase">Actions</span>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm font-medium text-neo-black/70">
                    {result.risk_explanation.priority.map((a: string, i: number) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

          {result?.findings_analyzed?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <h2 className="text-xl font-bold uppercase mb-4">Findings ({result.findings_analyzed.length})</h2>
              <div className="space-y-3">
                {result.findings_analyzed.map((f: any, i: number) => (
                  <div key={i} className="neo-card overflow-hidden">
                    <button onClick={() => setExpandedFinding(expandedFinding === i ? null : i)}
                      className="w-full p-4 flex items-center justify-between text-left">
                      <div className="flex items-center gap-3">
                        <span className={`neo-badge severity-${f.severity}`}>{f.severity}</span>
                        <span className="font-bold text-sm">{f.finding}</span>
                      </div>
                      {expandedFinding === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <AnimatePresence>
                      {expandedFinding === i && (
                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t-3 border-neo-black">
                          <div className="p-4 space-y-3 text-sm">
                            <div><span className="font-bold uppercase">What happened:</span> <span className="font-medium">{f.what_happened}</span></div>
                            <div><span className="font-bold uppercase">Why it matters:</span> <span className="font-medium">{f.why_it_matters}</span></div>
                            <div><span className="font-bold uppercase">Impact:</span> <span className="font-medium">{f.potential_impact}</span></div>
                            {f.evidence && <div><span className="font-bold uppercase">Evidence:</span> <code className="font-mono text-xs bg-neo-black/5 px-2 py-1">{f.evidence}</code></div>}
                            {f.recommendation && <div><span className="font-bold uppercase">Fix:</span> <span className="font-medium">{f.recommendation}</span></div>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {result?.dns && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="neo-card p-6 mb-6">
              <h2 className="text-xl font-bold uppercase mb-4 flex items-center gap-2"><Shield className="w-5 h-5" /> DNS Records</h2>
              <div className="space-y-2 text-sm font-mono">
                {result.dns.records?.A && <div><span className="font-bold">A:</span> {result.dns.records.A.join(", ")}</div>}
                {result.dns.records?.AAAA && <div><span className="font-bold">AAAA:</span> {result.dns.records.AAAA.join(", ")}</div>}
                {result.dns.records?.MX && <div><span className="font-bold">MX:</span> {result.dns.records.MX.join(", ")}</div>}
                {result.dns.records?.NS && <div><span className="font-bold">NS:</span> {result.dns.records.NS.join(", ")}</div>}
                {result.dns.records?.TXT && <div><span className="font-bold">TXT:</span> {result.dns.records.TXT.join(", ")}</div>}
                <div><span className="font-bold">DNSSEC:</span> {result.dns.dnssec?.supported ? "Supported" : "Not supported"}</div>
              </div>
            </motion.div>
          )}

          {result?.tls && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="neo-card p-6 mb-6">
              <h2 className="text-xl font-bold uppercase mb-4">TLS / SSL Certificate</h2>
              <div className="space-y-2 text-sm font-mono">
                <div><span className="font-bold">Valid:</span> {result.tls.valid ? "Yes" : "No"}</div>
                {result.tls.issuer && <div><span className="font-bold">Issuer:</span> {result.tls.issuer}</div>}
                {result.tls.version && <div><span className="font-bold">Version:</span> {result.tls.version}</div>}
                {result.tls.expiry && <div><span className="font-bold">Expires:</span> {new Date(result.tls.expiry).toLocaleDateString()}</div>}
              </div>
            </motion.div>
          )}

          {result?.headers && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="neo-card p-6 mb-6">
              <h2 className="text-xl font-bold uppercase mb-4">Response Headers</h2>
              <div className="space-y-2 text-sm font-mono">
                {result.headers.server && <div><span className="font-bold">Server:</span> {result.headers.server}</div>}
                {result.headers.contentType && <div><span className="font-bold">Content-Type:</span> {result.headers.contentType}</div>}
              </div>
            </motion.div>
          )}

          {result?.correlations?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="neo-card p-6 mb-6">
              <h2 className="text-xl font-bold uppercase mb-4">Correlations</h2>
              <ul className="space-y-2">
                {result.correlations.map((c: any, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-medium"><span className="text-neo-purple">→</span>{c.description || c}</li>
                ))}
              </ul>
            </motion.div>
          )}

          {result?.web_updates?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <h2 className="text-xl font-bold uppercase mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5" /> Web Updates
              </h2>
              <p className="text-sm text-neo-black/60 font-medium mb-4">Recommended changes to improve your website security posture.</p>
              <div className="space-y-3">
                {result.web_updates.map((u: any, i: number) => (
                  <div key={i} className="neo-card p-5 border-l-4 border-l-neo-purple">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-neo-purple bg-neo-purple/10 px-2 py-1">{u.category}</span>
                        <span className="font-bold text-sm">{u.title}</span>
                      </div>
                      <span className={`neo-badge severity-${u.priority === "CRITICAL" ? "high" : u.priority === "HIGH" ? "high" : u.priority === "MEDIUM" ? "medium" : "low"}`}>{u.priority}</span>
                    </div>
                    <p className="text-sm font-medium text-neo-black/70 mb-3">{u.description}</p>
                    <div className="bg-neo-black/5 p-3 mb-3">
                      <span className="font-bold text-xs uppercase block mb-1">How to fix:</span>
                      <p className="text-sm font-medium">{u.how_to_fix}</p>
                    </div>
                    {u.code_example && (
                      <div className="bg-neo-black text-neo-green p-3 font-mono text-xs overflow-x-auto">
                        <pre>{u.code_example}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
