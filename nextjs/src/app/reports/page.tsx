"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, FileText, Download, Zap, ChevronDown, ChevronUp, Globe, Plus, Paintbrush, Send } from "lucide-react";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import toast from "react-hot-toast";

interface Report {
  id: string;
  target_url: string;
  report_type: string;
  title: string;
  summary: string;
  risk_level: string;
  findings: any[];
  content: any;
  version: number;
  created_at: string;
}

interface Monitor {
  id: string;
  target_url: string;
  status: string;
  schedule_type: string;
}

const STYLE_PRESETS = [
  { label: "Default", prompt: "" },
  { label: "Dark Corporate", prompt: "dark theme, professional corporate style, navy blue background, white text, clean minimal layout, blue accent colors" },
  { label: "Cyberpunk", prompt: "cyberpunk hacker theme, neon green on black, glowing borders, matrix style, tech futuristic" },
  { label: "Minimal White", prompt: "clean white background, minimal design, black text, lots of whitespace, modern simple" },
  { label: "Bold Red", prompt: "aggressive bold style, red and black, strong contrast, urgent feel, warning theme" },
  { label: "Gradient Modern", prompt: "modern gradient backgrounds, purple to blue, smooth transitions, professional glass morphism" },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [reportType, setReportType] = useState("full");
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [stylePrompt, setStylePrompt] = useState("");
  const [showStylePicker, setShowStylePicker] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    authFetch("/api/reports").then(r => r.json()).then(d => { setReports(d.reports || []); setLoading(false); }).catch(() => setLoading(false));
    authFetch("/api/monitoring").then(r => r.json()).then(d => { setMonitors(d.monitors || []); }).catch(() => {});
  }, [user]);

  async function generateReport(url: string) {
    if (!url) { toast.error("Enter a URL first"); return; }
    setGenerating(true);
    try {
      const domain = url.replace(/^https?:\/\//, "").split("/")[0];
      toast.loading("Scanning " + domain + "...", { id: "scan" });

      const scanRes = await authFetch("/api/scan", { method: "POST", body: JSON.stringify({ url: domain }) });
      const scanData = await scanRes.json();
      if (scanData.error || !scanData.scan) { toast.error(scanData.error || "Scan failed", { id: "scan" }); setGenerating(false); return; }

      toast.loading("Analyzing findings...", { id: "scan" });
      const analyzeRes = await authFetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ url: domain, scan: scanData.scan, dns: scanData.dns, tls: scanData.tls }),
      });
      const analyzed = await analyzeRes.json();
      if (analyzed.error) { toast.error(analyzed.error, { id: "scan" }); setGenerating(false); return; }

      const content = {
        executive_summary: analyzed.risk_explanation?.meaning || "Security analysis completed.",
        risk_summary: analyzed.risk_explanation,
        findings: analyzed.findings_analyzed || [],
        correlations: analyzed.correlations || [],
        web_updates: analyzed.web_updates || [],
        severity_summary: analyzed.severity_summary || {},
        dns: scanData.dns,
        tls: scanData.tls,
        headers: scanData.scan?.headers,
        recommendations: (analyzed.findings_analyzed || []).map((f: any) => f.recommendation).filter(Boolean),
      };

      toast.loading("Saving report...", { id: "scan" });
      const res = await authFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          target_url: domain,
          report_type: reportType,
          title: reportType.toUpperCase() + " Security Report — " + domain,
          content,
        }),
      });
      const data = await res.json();
      if (data.report) {
        setReports(prev => [data.report, ...prev]);
        setNewUrl("");
        setShowUrlInput(false);
        toast.success("Report generated! Choose a format to download.", { id: "scan" });
      }
    } catch { toast.error("Failed to generate report", { id: "scan" }); }
    setGenerating(false);
  }

  async function exportReport(id: string, format: string, prompt?: string) {
    setExportingId(id);
    setShowStylePicker(null);
    try {
      const body: any = { report_id: id, format };
      if (prompt) body.style_prompt = prompt;

      const res = await authFetch("/api/reports/export", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || "Export failed"); setExportingId(null); return; }
      const styleSource = res.headers.get("X-Style-Source");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nesti-report-" + id + "." + format;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${format.toUpperCase()}${styleSource === "ai" ? " (AI Style)" : ""}`);
    } catch { toast.error("Export failed"); }
    setExportingId(null);
  }

  function handlePptClick(reportId: string) {
    if (showStylePicker === reportId) {
      exportReport(reportId, "pptx", stylePrompt);
      setStylePrompt("");
    } else {
      setShowStylePicker(reportId);
    }
  }

  if (loading) return <div className="min-h-screen bg-neo-white flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!user) return (
    <div className="min-h-screen bg-neo-white flex items-center justify-center">
      <div className="neo-card p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Login Required</h2>
        <p className="font-medium mb-4">Please login to view reports.</p>
        <Link href="/login"><button className="neo-btn neo-btn-primary">LOGIN</button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neo-white">
      <main className="max-w-7xl mx-auto px-6 pt-8 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4"><span className="bg-neo-yellow px-3 border-3 border-neo-black inline-block rotate-[-1deg]">Security</span> Reports</h1>
          <p className="text-lg text-neo-black/70 font-medium">Generate security reports from monitored targets or scan new URLs.</p>
        </motion.div>

        {/* Monitor Targets */}
        {monitors.length > 0 && (
          <div className="border-3 border-neo-black bg-white p-6 mb-6 shadow-[6px_6px_0_#1a1a2e]">
            <h3 className="font-bold uppercase mb-4 flex items-center gap-2"><Globe className="w-5 h-5 text-neo-purple" /> Monitored Targets</h3>
            <p className="text-sm text-neo-black/60 font-medium mb-4">Click a monitored URL to generate a report from its latest scan data.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {monitors.map((m) => (
                <button
                  key={m.id}
                  onClick={() => generateReport(m.target_url)}
                  disabled={generating}
                  className="text-left p-4 border-3 border-neo-black bg-neo-yellow/30 hover:bg-neo-blue/30 transition-all cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none shadow-[3px_3px_0_#1a1a2e]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-neo-purple" />
                    <span className="font-mono font-bold text-sm">{m.target_url}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-1">
                    <span className={`neo-badge ${m.status === "active" ? "bg-neo-green text-white" : "bg-neo-orange text-white"}`}>{m.status}</span>
                    <span className="text-neo-black/40">{m.schedule_type}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Generate New */}
        <div className="border-3 border-neo-black bg-white p-6 mb-8 shadow-[6px_6px_0_#1a1a2e]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold uppercase flex items-center gap-2"><Zap className="w-5 h-5 text-neo-purple" /> Generate New Report</h3>
            <button onClick={() => setShowUrlInput(!showUrlInput)} className="neo-btn text-xs py-2 px-3 flex items-center gap-1">
              <Plus className="w-4 h-4" /> Custom URL
            </button>
          </div>
          {showUrlInput && (
            <div className="flex flex-col sm:flex-row gap-3">
              <input type="text" value={newUrl} onChange={e => setNewUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && generateReport(newUrl)} placeholder="e.g. example.com" className="flex-1 neo-input" />
              <select value={reportType} onChange={e => setReportType(e.target.value)} className="neo-input">
                <option value="full">Full Report</option>
                <option value="technical">Technical</option>
                <option value="executive">Executive Summary</option>
              </select>
              <button onClick={() => generateReport(newUrl)} disabled={generating || !newUrl} className="neo-btn neo-btn-primary flex items-center justify-center gap-2">
                {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>

        {/* Reports List */}
        {reports.length === 0 ? (
          <div className="neo-card p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-neo-black/30" />
            <h3 className="text-xl font-bold mb-2">No Reports Yet</h3>
            <p className="font-medium text-neo-black/60">Select a monitored target or scan a new URL above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((r, i) => {
              const isExpanded = expandedReport === r.id;
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="neo-card overflow-hidden">
                  <button onClick={() => setExpandedReport(isExpanded ? null : r.id)} className="w-full p-6 text-left">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-neo-purple border-2 border-neo-black flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <span className="font-mono font-bold">{r.target_url}</span>
                          <div className="text-sm text-neo-black/50 font-medium">{r.title} · v{r.version} · {new Date(r.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`neo-badge severity-${r.risk_level}`}>{r.risk_level?.toUpperCase() || "N/A"}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t-3 border-neo-black">
                        <div className="p-6">
                          {r.summary && <div className="mb-4"><span className="font-bold uppercase text-sm">Summary:</span><p className="font-medium mt-1 text-sm text-neo-black/70">{r.summary}</p></div>}
                          {r.content?.risk_summary && (
                            <div className="mb-4">
                              <span className="font-bold uppercase text-sm">Risk Level: </span>
                              <span className={`neo-badge severity-${r.content.risk_summary.level?.toLowerCase()}`}>{r.content.risk_summary.level}</span>
                              <p className="text-sm font-medium text-neo-black/70 mt-1">{r.content.risk_summary.meaning}</p>
                            </div>
                          )}

                          <div className="mt-6">
                            <span className="font-bold uppercase text-sm mb-3 block">Download as:</span>
                            <div className="flex flex-wrap gap-3">
                              {FORMAT_OPTIONS.map((fmt) => (
                                fmt.value === "pptx" ? (
                                  <div key={fmt.value} className="relative">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handlePptClick(r.id); }}
                                      disabled={exportingId === r.id}
                                      className={`neo-btn text-sm flex items-center gap-2 ${fmt.color} border-neo-black`}
                                    >
                                      {exportingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paintbrush className="w-4 h-4" />}
                                      {fmt.label}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    key={fmt.value}
                                    onClick={(e) => { e.stopPropagation(); exportReport(r.id, fmt.value); }}
                                    disabled={exportingId === r.id}
                                    className={`neo-btn text-sm flex items-center gap-2 ${fmt.color} border-neo-black`}
                                  >
                                    {exportingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    {fmt.label}
                                  </button>
                                )
                              ))}
                            </div>

                            {/* Style Picker Popup */}
                            <AnimatePresence>
                              {showStylePicker === r.id && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                  className="mt-4 border-3 border-neo-black p-4 bg-neo-yellow/10">
                                  <h4 className="font-bold uppercase text-sm mb-3 flex items-center gap-2"><Paintbrush className="w-4 h-4" /> PPT Style Template</h4>
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {STYLE_PRESETS.map((preset) => (
                                      <button key={preset.label}
                                        onClick={() => setStylePrompt(preset.prompt)}
                                        className={`px-3 py-1 text-xs font-bold uppercase border-2 border-neo-black transition-all ${stylePrompt === preset.prompt ? "bg-neo-purple text-white" : "bg-white hover:bg-neo-yellow/50"}`}
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                  </div>
                                  <textarea
                                    value={stylePrompt}
                                    onChange={e => setStylePrompt(e.target.value)}
                                    placeholder="e.g. dark theme with neon accents, professional corporate, minimal clean white, cyberpunk hacker style..."
                                    className="w-full neo-input text-sm h-20 resize-none mb-3"
                                  />
                                  <div className="flex gap-2">
                                    <button onClick={() => { exportReport(r.id, "pptx", stylePrompt); }}
                                      disabled={exportingId === r.id}
                                      className="neo-btn neo-btn-primary text-sm flex items-center gap-2">
                                      {exportingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                      Generate & Download PPT
                                    </button>
                                    <button onClick={() => { setShowStylePicker(null); setStylePrompt(""); }}
                                      className="neo-btn text-sm">
                                      Cancel
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
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
const FORMAT_OPTIONS = [
  { value: "pdf", label: "PDF", color: "bg-neo-pink text-white" },
  { value: "docx", label: "Word", color: "bg-neo-blue text-white" },
  { value: "xlsx", label: "Excel", color: "bg-neo-green text-white" },
  { value: "pptx", label: "PowerPoint", color: "bg-neo-orange text-white" },
];
