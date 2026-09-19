"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const checkData = await checkRes.json();
      if (!checkData.exists) {
        toast.error("Email belum terdaftar! Silakan register terlebih dahulu.");
        setLoading(false);
        return;
      }

      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Logged in!");
      router.push("/scan");
    } catch {
      toast.error("Login failed. Check your credentials.");
    }
    setLoading(false);
  }

  async function handleGoogle() {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      toast.success("Logged in with Google!");
      router.push("/scan");
    } catch { toast.error("Google login failed"); }
  }

  return (
    <div className="min-h-screen bg-neo-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="neo-card p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-neo-yellow border-3 border-neo-black mb-4">
              <Zap className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold uppercase">Login</h1>
            <p className="font-medium text-neo-black/60 mt-2">Access your security dashboard.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold uppercase">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full neo-input mt-1" />
            </div>
            <div>
              <label className="text-sm font-bold uppercase">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} className="w-full neo-input mt-1" />
            </div>
            <button onClick={handleLogin} disabled={loading} className="neo-btn neo-btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "LOGIN"}
            </button>
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-0.5 bg-neo-black/20" />
              <span className="text-sm font-bold uppercase text-neo-black/40">OR</span>
              <div className="flex-1 h-0.5 bg-neo-black/20" />
            </div>
            <button onClick={handleGoogle} className="neo-btn w-full bg-white">SIGN IN WITH GOOGLE</button>
          </div>
          <p className="text-center text-sm font-medium mt-6">
            No account? <Link href="/register" className="font-bold underline">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
