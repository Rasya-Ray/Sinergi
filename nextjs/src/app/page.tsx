"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, Zap, Search, Brain, AlertTriangle, FileCheck, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { authFetch } from "@/lib/api";
import { useState, useEffect } from "react";

const features = [
  { icon: Search, title: "Deep Scan", desc: "Full HTTP header analysis, cookie inspection, redirect chain tracking, and technology fingerprinting.", color: "bg-neo-blue" },
  { icon: Brain, title: "AI Agent", desc: "Nesti analyzes findings, correlates issues, and generates risk explanations using an AI security agent.", color: "bg-neo-purple" },
  { icon: AlertTriangle, title: "Vulnerability Detection", desc: "Identifies security misconfigurations, missing headers, cookie flaws, and suspicious redirects.", color: "bg-neo-pink" },
  { icon: FileCheck, title: "Security Reports", desc: "Comprehensive reports with severity ratings, risk explanation, and actionable remediation steps.", color: "bg-neo-green" },
];

const steps = ["Scan", "Analyze", "Fix"];

interface Limits {
  ppt: { used: number; limit: number; remaining: number };
  tg_ai: { used: number; limit: number; remaining: number };
  tg_laporan: { used: number; limit: number; remaining: number };
  tg_scan: { used: number; limit: number; remaining: number };
}

function LimitBar({ label, used, limit, color }: { label: string; used: number; limit: number; color: string }) {
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-bold text-xs uppercase">{label}</span>
        <span className="font-mono text-xs">{remaining}/{limit}</span>
      </div>
      <div className="w-full h-3 bg-neo-gray border-2 border-neo-black">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [limits, setLimits] = useState<Limits | null>(null);

  useEffect(() => {
    if (user) {
      authFetch("/api/user/limits")
        .then((r) => r.json())
        .then((d) => setLimits(d))
        .catch(() => {});
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-neo-white">
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-32">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center">
            <motion.div initial={{ rotate: -5 }} animate={{ rotate: -3 }} className="inline-block mb-6">
              <span className="bg-neo-yellow px-4 py-2 border-3 border-neo-black font-bold uppercase text-sm tracking-wider shadow-[4px_4px_0_var(--color-neo-black)]">AI-Powered Security Analysis</span>
            </motion.div>
            <h1 className="text-5xl md:text-7xl font-bold uppercase leading-none mb-6">
              <span className="bg-neo-blue px-4 border-3 border-neo-black inline-block rotate-[-2deg] mb-2">NESTI</span>
              <br />
              <span className="text-3xl md:text-4xl">AI Web Security Analyst</span>
            </h1>
            <p className="text-lg md:text-xl font-medium mb-8 max-w-2xl mx-auto">
              Instantly analyze your website for security vulnerabilities, misconfigurations, and best practices — powered by AI.
            </p>
            <p className="text-sm font-mono text-neo-black/50 mb-10">No installation required. Just enter a URL and scan.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/scan"><button className="neo-btn neo-btn-primary text-lg">START SCANNING →</button></Link>
              <Link href="/history"><button className="neo-btn text-lg">VIEW HISTORY</button></Link>
            </div>
          </motion.div>
        </div>
      </section>

      {user && limits && (
        <section className="max-w-7xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="neo-card p-6 bg-neo-yellow">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5" />
              <h2 className="font-bold text-lg uppercase">Your Hourly Limits</h2>
              <span className="ml-auto font-mono text-xs text-neo-black/50">Realtime</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <LimitBar label="PPT Export" used={limits.ppt.used} limit={limits.ppt.limit} color="bg-neo-pink" />
              <LimitBar label="WA AI Chat" used={limits.tg_ai.used} limit={limits.tg_ai.limit} color="bg-neo-purple" />
              <LimitBar label="WA Laporan" used={limits.tg_laporan.used} limit={limits.tg_laporan.limit} color="bg-neo-blue" />
              <LimitBar label="WA Scan" used={limits.tg_scan.used} limit={limits.tg_scan.limit} color="bg-neo-green" />
            </div>
          </motion.div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-6 pb-32">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="neo-card p-6">
              <div className={`${f.color} w-12 h-12 flex items-center justify-center border-3 border-neo-black mb-4`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold uppercase mb-2">{f.title}</h3>
              <p className="text-sm font-medium text-neo-black/70">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-32 text-center">
          <h2 className="text-3xl md:text-4xl font-bold uppercase mb-16">How It Works</h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-4">
                <div className="neo-card p-6 text-center w-40">
                  <div className="text-4xl font-bold mb-2">{i + 1}</div>
                  <div className="font-bold uppercase">{s}</div>
                </div>
                {i < steps.length - 1 && <div className="hidden md:block text-3xl font-bold">→</div>}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="mt-32 neo-card p-12 text-center bg-neo-yellow">
          <h2 className="text-3xl font-bold uppercase mb-4">Ready to Secure Your Website?</h2>
          <p className="font-medium mb-8 max-w-lg mx-auto">Start scanning now and get actionable security insights in seconds.</p>
          <Link href="/scan"><button className="neo-btn neo-btn-primary text-lg">GET STARTED →</button></Link>
        </motion.div>

        <div className="mt-20 text-center">
          <p className="text-sm font-mono text-neo-black/40">Powered by OpenClaw AI • Nesti v3.0 • 2025</p>
        </div>
      </section>
    </div>
  );
}
