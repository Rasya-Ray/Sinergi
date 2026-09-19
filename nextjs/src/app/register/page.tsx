"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, Zap } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setLoading(true);
    try {
      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const checkData = await checkRes.json();
      if (checkData.exists) {
        toast.error("Email sudah terdaftar! Silakan login.");
        setLoading(false);
        return;
      }

      await createUserWithEmailAndPassword(auth, email, password);
      toast.success("Account created!");
      router.push("/scan");
    } catch (err: any) {
      if (err?.code === "auth/email-already-in-use") {
        toast.error("Email sudah terdaftar di Firebase! Silakan login.");
      } else {
        toast.error("Registration failed");
      }
    }
    setLoading(false);
  }

  async function handleGoogle() {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      toast.success("Signed in with Google!");
      router.push("/scan");
    } catch { toast.error("Google sign-in failed"); }
  }

  return (
    <div className="min-h-screen bg-neo-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="neo-card p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-neo-yellow border-3 border-neo-black mb-4">
              <Zap className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold uppercase">Register</h1>
            <p className="font-medium text-neo-black/60 mt-2">Create your security account.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold uppercase">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full neo-input mt-1" />
            </div>
            <div>
              <label className="text-sm font-bold uppercase">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full neo-input mt-1" />
            </div>
            <div>
              <label className="text-sm font-bold uppercase">Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRegister()} className="w-full neo-input mt-1" />
            </div>
            <button onClick={handleRegister} disabled={loading} className="neo-btn neo-btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "REGISTER"}
            </button>
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-0.5 bg-neo-black/20" />
              <span className="text-sm font-bold uppercase text-neo-black/40">OR</span>
              <div className="flex-1 h-0.5 bg-neo-black/20" />
            </div>
            <button onClick={handleGoogle} className="neo-btn w-full bg-white">SIGN IN WITH GOOGLE</button>
          </div>
          <p className="text-center text-sm font-medium mt-6">
            Have an account? <Link href="/login" className="font-bold underline">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
