"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Eye, EyeOff, Shield, Clock, AlertTriangle, CheckCircle, Zap, Lock, Info } from "lucide-react";
import toast from "react-hot-toast";

export default function PasswordPage() {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const strengthConfig: Record<string, { label: string; color: string; bgColor: string; icon: any; description: string }> = {
    Strong: { label: "STRONG", color: "text-neo-black", bgColor: "bg-neo-green", icon: Shield, description: "Excellent! Your password is highly resistant to cracking attempts." },
    Good: { label: "GOOD", color: "text-neo-black", bgColor: "bg-neo-blue", icon: CheckCircle, description: "Solid password. Could be even stronger with a few tweaks." },
    Fair: { label: "FAIR", color: "text-neo-black", bgColor: "bg-neo-orange", icon: AlertTriangle, description: "Moderate strength. Vulnerable to targeted attacks. Consider improving it." },
    Weak: { label: "WEAK", color: "text-neo-black", bgColor: "bg-neo-pink", icon: AlertTriangle, description: "Easily cracked. This password provides minimal security." },
    "Very Weak": { label: "VERY WEAK", color: "text-neo-black", bgColor: "bg-neo-pink", icon: AlertTriangle, description: "Extremely vulnerable. Can be cracked in seconds by any attacker." },
  };

  function getScoreBar(score: number) {
    if (score >= 7) return { width: "100%", color: "bg-neo-green" };
    if (score >= 5) return { width: "70%", color: "bg-neo-blue" };
    if (score >= 3) return { width: "50%", color: "bg-neo-orange" };
    return { width: "25%", color: "bg-neo-pink" };
  }

  function getVulnerabilities(pw: string): string[] {
    const vulns: string[] = [];
    if (/^[a-z]+$/.test(pw)) vulns.push("Only lowercase letters — trivially brute-forced");
    if (/^[0-9]+$/.test(pw)) vulns.push("Only numbers — crackable in seconds");
    if (pw.length < 8) vulns.push("Too short — under 8 characters is trivially crackable");
    if (pw.length >= 8 && pw.length < 12) vulns.push("Medium length — a determined attacker with GPU rigs can crack this");
    if (/^(password|123456|qwerty|admin|letmein|welcome|monkey|dragon)/i.test(pw)) vulns.push("Common password — found in every leaked password database");
    if (!/[A-Z]/.test(pw)) vulns.push("No uppercase letters — reduces character space significantly");
    if (!/[0-9]/.test(pw)) vulns.push("No numbers — limits possible combinations");
    if (!/[^A-Za-z0-9]/.test(pw)) vulns.push("No special characters — missing symbols like !@#$%^&*");
    if (/(.)\1{2,}/.test(pw)) vulns.push("Repeated characters detected — pattern-based cracking is faster");
    if (/^(abc|123|qwe|asd|zxc)/i.test(pw)) vulns.push("Sequential characters — easily predicted patterns");
    return vulns;
  }

  function getStrengthTips(pw: string): string[] {
    const tips: string[] = [];
    if (pw.length < 16) tips.push("Use 16+ characters for maximum security — longer passwords are exponentially harder to crack");
    if (!/[A-Z]/.test(pw)) tips.push("Add uppercase letters (A-Z) to expand the character pool");
    if (!/[0-9]/.test(pw)) tips.push("Mix in numbers (0-9) to increase complexity");
    if (!/[^A-Za-z0-9]/.test(pw)) tips.push("Include special characters (!@#$%^&*) for maximum entropy");
    if (pw.length < 12) tips.push("Make it longer — each additional character multiplies cracking time");
    if (/^[a-z]+$/.test(pw) || /^[0-9]+$/.test(pw)) tips.push("Use a mix of character types, not just one category");
    tips.push("Consider using a passphrase — 4+ random words like 'correct-horse-battery-staple'");
    tips.push("Never reuse passwords across different sites — use a password manager");
    tips.push("Enable two-factor authentication (2FA) for an extra security layer");
    return tips;
  }

  function getRiskLevel(score: number): { level: string; color: string; description: string } {
    if (score >= 7) return { level: "MINIMAL RISK", color: "text-neo-green", description: "Your password can withstand offline attacks with current hardware. Even state-level adversaries would need significant resources." };
    if (score >= 5) return { level: "LOW RISK", color: "text-neo-blue", description: "Reasonably secure against most attacks. A well-funded attacker with GPU clusters could potentially crack it given enough time." };
    if (score >= 3) return { level: "MODERATE RISK", color: "text-neo-orange", description: "Vulnerable to targeted attacks. A attacker with consumer-grade GPU hardware (4x RTX 4090) could crack this within hours to days." };
    if (score >= 1) return { level: "HIGH RISK", color: "text-neo-pink", description: "Easily cracked with basic hardware. Any attacker with a modern gaming PC can break this password in minutes to hours." };
    return { level: "CRITICAL RISK", color: "text-neo-pink", description: "Cracked instantly. This password is effectively no protection at all — it exists in common wordlists and can be brute-forced in seconds." };
  }

  async function checkPassword() {
    if (!password) { toast.error("Enter a password to check"); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/password-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); setLoading(false); return; }
      setResult(data);
      toast.success(`Password analyzed — ${data.strength}`);
    } catch { toast.error("Failed to check password"); }
    setLoading(false);
  }

  const cfg = result ? (strengthConfig[result.strength] || strengthConfig["Weak"]) : null;
  const vulns = result ? getVulnerabilities(password) : [];
  const tips = result ? getStrengthTips(password) : [];
  const risk = result ? getScoreLevel(result.score) : null;

  return (
    <div className="min-h-screen bg-neo-white">
      <main className="max-w-3xl mx-auto px-6 pt-8 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-neo-yellow px-3 border-3 border-neo-black inline-block rotate-[-1deg]">Password</span> Strength Analyzer
          </h1>
          <p className="text-lg text-neo-black/70 font-medium">Analyze your password security. Learn why it matters and how to fix it.</p>
        </motion.div>

        <div className="neo-card p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && checkPassword()}
                placeholder="Enter a password to analyze" className="w-full neo-input pr-10 font-mono" />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neo-black/50 hover:text-neo-black">
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button onClick={checkPassword} disabled={loading} className="neo-btn neo-btn-primary flex items-center justify-center gap-2 sm:w-auto">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Analyzing...</> : <><Zap className="w-5 h-5" />ANALYZE</>}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Lock className="w-3 h-3 text-neo-black/40" />
            <p className="text-xs font-medium text-neo-black/40">Your password is checked locally and never stored or transmitted to any server.</p>
          </div>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Strength Label */}
            <div className={`neo-card p-6 text-center ${cfg?.bgColor} border-neo-black`}>
              <div className="flex items-center justify-center gap-3 mb-2">
                {cfg?.icon && <cfg.icon className={`w-8 h-8 ${cfg?.color}`} />}
                <span className={`text-3xl font-bold uppercase ${cfg?.color}`}>{cfg?.label}</span>
              </div>
              <p className={`font-medium text-sm ${cfg?.color} opacity-90`}>{cfg?.description}</p>
            </div>

            {/* Score Bar */}
            <div className="neo-card p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold uppercase text-sm">Security Score</span>
                <span className="font-bold font-mono text-lg">{result.score}/10</span>
              </div>
              <div className="h-4 bg-neo-black/10 border-2 border-neo-black w-full">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: getScoreBar(result.score).width }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-full ${getScoreBar(result.score).color}`}
                />
              </div>
              <p className={`text-sm font-bold mt-2 uppercase ${getRiskLevel(result.score).color}`}>{getRiskLevel(result.score).level}</p>
            </div>

            {/* Brute Force Time */}
            <div className="neo-card p-6">
              <h3 className="font-bold uppercase mb-3 flex items-center gap-2"><Clock className="w-5 h-5" /> Time to Crack</h3>
              <div className="bg-neo-black text-neo-yellow px-5 py-4 border-3 border-neo-black text-center">
                <div className="text-4xl font-bold font-mono">{result.crack_time}</div>
              </div>
              <p className="text-sm font-medium text-neo-black/60 mt-3">{getRiskLevel(result.score).description}</p>
            </div>

            {/* Stats */}
            <div className="neo-card p-6">
              <h3 className="font-bold uppercase mb-4">Password Stats</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 border-3 border-neo-black bg-white">
                  <div className="text-3xl font-bold font-mono">{result.length}</div>
                  <div className="text-xs font-bold uppercase text-neo-black/50 mt-1">Characters</div>
                </div>
                <div className="text-center p-4 border-3 border-neo-black bg-white">
                  <div className="text-3xl font-bold font-mono">{result.unique_chars}</div>
                  <div className="text-xs font-bold uppercase text-neo-black/50 mt-1">Unique Chars</div>
                </div>
                <div className="text-center p-4 border-3 border-neo-black bg-white">
                  <div className="text-3xl font-bold font-mono">{result.entropy?.toFixed(1)}</div>
                  <div className="text-xs font-bold uppercase text-neo-black/50 mt-1">Entropy (bits)</div>
                </div>
              </div>
            </div>

            {/* Vulnerabilities */}
            {vulns.length > 0 && (
              <div className="neo-card p-6 border-l-4 border-l-neo-pink">
                <h3 className="font-bold uppercase mb-4 flex items-center gap-2 text-neo-pink"><AlertTriangle className="w-5 h-5" /> Vulnerabilities Found ({vulns.length})</h3>
                <ul className="space-y-3">
                  {vulns.map((v, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-medium">
                      <span className="w-6 h-6 flex-shrink-0 bg-neo-pink text-white border-2 border-neo-black flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <span className="text-neo-black/80">{v}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm font-medium text-neo-black/60 mt-4 p-3 bg-neo-pink/10 border-2 border-neo-pink/30">
                  <strong>Why this matters:</strong> Each vulnerability above reduces the time an attacker needs to crack your password. Combined, they can reduce cracking time from years to seconds.
                </p>
              </div>
            )}

            {/* AI Suggestions */}
            <div className="neo-card p-6 border-l-4 border-l-neo-purple">
              <h3 className="font-bold uppercase mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-neo-purple" /> How to Make a Strong Password</h3>
              <ul className="space-y-3">
                {tips.map((t, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-medium">
                    <span className="w-6 h-6 flex-shrink-0 bg-neo-purple text-white border-2 border-neo-black flex items-center justify-center text-xs font-bold">✓</span>
                    <span className="text-neo-black/80">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Example Strong Passwords */}
            <div className="neo-card p-6">
              <h3 className="font-bold uppercase mb-4 flex items-center gap-2"><Info className="w-5 h-5" /> Examples of Strong Passwords</h3>
              <div className="space-y-3">
                <div className="p-3 bg-neo-black/5 border-2 border-neo-black/10 font-mono text-sm">
                  <span className="text-neo-purple font-bold">Passphrase:</span> <span className="font-medium">correct-horse-battery-staple</span>
                  <span className="text-xs text-neo-black/50 ml-2">(4 random words = 80+ bits entropy)</span>
                </div>
                <div className="p-3 bg-neo-black/5 border-2 border-neo-black/10 font-mono text-sm">
                  <span className="text-neo-purple font-bold">Mixed:</span> <span className="font-medium">Tr0ub4dor&amp;3</span>
                  <span className="text-xs text-neo-black/50 ml-2">(word + substitutions + numbers + symbol)</span>
                </div>
                <div className="p-3 bg-neo-black/5 border-2 border-neo-black/10 font-mono text-sm">
                  <span className="text-neo-purple font-bold">Random:</span> <span className="font-medium">k7$2mP!9xLq#nR4v</span>
                  <span className="text-xs text-neo-black/50 ml-2">(16 chars truly random = 100+ bits)</span>
                </div>
              </div>
              <p className="text-sm font-medium text-neo-black/60 mt-4">
                <strong>Pro tip:</strong> Use a password manager like Bitwarden, 1Password, or KeePass to generate and store unique passwords for every site.
              </p>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

function getScoreLevel(score: number) {
  if (score >= 7) return { level: "MINIMAL RISK", color: "text-neo-green", description: "Your password can withstand offline attacks with current hardware. Even state-level adversaries would need significant resources." };
  if (score >= 5) return { level: "LOW RISK", color: "text-neo-blue", description: "Reasonably secure against most attacks. A well-funded attacker with GPU clusters could potentially crack it given enough time." };
  if (score >= 3) return { level: "MODERATE RISK", color: "text-neo-orange", description: "Vulnerable to targeted attacks. A attacker with consumer-grade GPU hardware could crack this within hours to days." };
  if (score >= 1) return { level: "HIGH RISK", color: "text-neo-pink", description: "Easily cracked with basic hardware. Any attacker with a modern gaming PC can break this password in minutes." };
  return { level: "CRITICAL RISK", color: "text-neo-pink", description: "Cracked instantly. This password is effectively no protection at all." };
}
