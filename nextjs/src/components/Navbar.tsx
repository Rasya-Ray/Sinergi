"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NestiLogo } from "./NestiLogo";

const NAV_LINKS = [
  { href: "/", label: "HOME" },
  { href: "/scan", label: "WEBSITE" },
  { href: "/chat", label: "CHAT AI" },
  { href: "/community", label: "COMMUNITY" },
  { href: "/tools/password", label: "PASSWORD" },
  { href: "/monitoring", label: "MONITOR" },
  { href: "/reports", label: "REPORTS" },
  { href: "/history", label: "HISTORY" },
  { href: "/telegram", label: "TELEGRAM" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <>
      {/* Desktop navbar */}
      <nav className="hidden lg:flex border-b-3 border-neo-black bg-neo-yellow">
        <Link href="/" className="flex items-center gap-3 px-6 py-3 border-r-3 border-neo-black cursor-pointer">
          <div className="logo-spin w-12 h-12 bg-neo-yellow flex items-center justify-center">
            <NestiLogo className="w-7 h-7" />
          </div>
          <span className="font-bold text-xl tracking-tight">NESTI</span>
        </Link>
        <div className="flex items-center gap-1 px-4 flex-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 font-bold text-sm tracking-wider border-3 border-neo-black transition-all ${
                pathname === href
                  ? "bg-neo-black text-neo-yellow shadow-none translate-x-[2px] translate-y-[2px]"
                  : "bg-white hover:bg-neo-blue shadow-[3px_3px_0_#1a1a2e] hover:shadow-[1px_1px_0_#1a1a2e] hover:translate-x-[2px] hover:translate-y-[2px]"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 px-4 border-l-3 border-neo-black">
          {user ? (
            <>
              <span className="font-mono text-xs max-w-[120px] truncate">{user.email}</span>
              <button
                onClick={handleLogout}
                className="neo-btn text-xs py-2 px-4"
              >
                LOGOUT
              </button>
            </>
          ) : (
            <Link href="/login" className="neo-btn text-xs py-2 px-4">
              LOGIN
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile hamburger */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b-3 border-neo-black bg-neo-yellow">
        <Link href="/" className="flex items-center gap-2">
          <div className="logo-spin w-10 h-10 bg-neo-yellow flex items-center justify-center">
            <NestiLogo className="w-6 h-6" />
          </div>
          <span className="font-bold text-lg">NESTI</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="neo-btn p-2"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-72 bg-neo-white border-l-3 border-neo-black shadow-[-6px_0_0_#1a1a2e] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b-3 border-neo-black bg-neo-purple">
              <div className="flex items-center gap-2">
                <div className="logo-spin w-8 h-8 bg-neo-yellow flex items-center justify-center cursor-pointer">
                  <NestiLogo className="w-5 h-5" />
                </div>
                <span className="font-bold text-white text-lg">NESTI</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 bg-white border-2 border-neo-black flex items-center justify-center hover:bg-neo-pink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 py-2">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-6 py-3 font-bold text-sm tracking-wider border-b-2 border-neo-black/10 transition-all ${
                    pathname === href
                      ? "bg-neo-black text-neo-yellow pl-8 border-l-4 border-l-neo-yellow"
                      : "hover:bg-neo-blue/20 hover:pl-8"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
            <div className="p-4 border-t-3 border-neo-black">
              {user ? (
                <>
                  <p className="font-mono text-xs mb-3 truncate">{user.email}</p>
                  <button
                    onClick={handleLogout}
                    className="neo-btn w-full text-xs"
                  >
                    LOGOUT
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="neo-btn w-full text-center text-xs block"
                >
                  LOGIN
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
