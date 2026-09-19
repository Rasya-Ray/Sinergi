"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Search, Brain, AlertTriangle, FileCheck, Activity } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { authFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { HeroIntro } from "@/components/HeroIntro";

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

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
      <HeroIntro />

      <section className="max-w-7xl mx-auto px-6 pt-24 pb-16">
        <AnimatedSection className="text-center mb-16">
          <span className="bg-neo-yellow px-4 py-2 border-3 border-neo-black font-bold uppercase text-sm tracking-wider shadow-[4px_4px_0_var(--color-neo-black)] inline-block rotate-[-2deg] mb-6">
            AI-Powered Security Analysis
          </span>
          <h2 className="text-4xl md:text-5xl font-bold uppercase leading-none mb-4">
            Instant Security Insights
          </h2>
          <p className="text-lg font-medium text-neo-black/70 max-w-2xl mx-auto">
            Analyze your website for security vulnerabilities, misconfigurations, and best practices — powered by AI.
          </p>
        </AnimatedSection>

        {user && limits && (
          <AnimatedSection className="mb-16">
            <div className="neo-card p-6 bg-neo-yellow">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-5 h-5" />
                <h3 className="font-bold text-lg uppercase">Your Hourly Limits</h3>
                <span className="ml-auto font-mono text-xs text-neo-black/50">Realtime</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <LimitBar label="PPT Export" used={limits.ppt.used} limit={limits.ppt.limit} color="bg-neo-pink" />
                <LimitBar label="WA AI Chat" used={limits.tg_ai.used} limit={limits.tg_ai.limit} color="bg-neo-purple" />
                <LimitBar label="WA Laporan" used={limits.tg_laporan.used} limit={limits.tg_laporan.limit} color="bg-neo-blue" />
                <LimitBar label="WA Scan" used={limits.tg_scan.used} limit={limits.tg_scan.limit} color="bg-neo-green" />
              </div>
            </div>
          </AnimatedSection>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-32">
          {features.map((f, i) => (
            <AnimatedSection key={f.title}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="neo-card p-6 h-full"
              >
                <div className={`${f.color} w-12 h-12 flex items-center justify-center border-3 border-neo-black mb-4`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold uppercase mb-2">{f.title}</h3>
                <p className="text-sm font-medium text-neo-black/70">{f.desc}</p>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection className="text-center mb-32">
          <h2 className="text-3xl md:text-4xl font-bold uppercase mb-16">How It Works</h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="neo-card p-6 text-center w-40"
                >
                  <div className="text-4xl font-bold mb-2">{i + 1}</div>
                  <div className="font-bold uppercase">{s}</div>
                </motion.div>
                {i < steps.length - 1 && <div className="hidden md:block text-3xl font-bold">→</div>}
              </div>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection>
          <div className="neo-card p-12 text-center bg-neo-yellow">
            <h2 className="text-3xl font-bold uppercase mb-4">Ready to Secure Your Website?</h2>
            <p className="font-medium mb-8 max-w-lg mx-auto">Start scanning now and get actionable security insights in seconds.</p>
            <Link href="/scan"><button className="neo-btn neo-btn-primary text-lg">GET STARTED →</button></Link>
          </div>
        </AnimatedSection>

        <div className="mt-20 text-center">
          <p className="text-sm font-mono text-neo-black/40">Powered by OpenClaw AI • Nesti v3.0 • 2025</p>
        </div>
      </section>
    </div>
  );
}
