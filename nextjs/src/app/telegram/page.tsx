"use client";

import { useAuth } from "@/lib/auth-context";
import { authFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { Bot, Link2, Unlink, MessageSquare, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

interface TelegramStatus {
  linked: boolean;
  telegram_id?: number;
  telegram_username?: string;
}

export default function TelegramPage() {
  const { user, dbUser } = useAuth();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (user) {
      authFetch(`/api/user/telegram`)
        .then((r) => r.json())
        .then((d) => {
          setStatus(d);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [user]);

  const handleUnlink = async () => {
    try {
      await authFetch("/api/user/telegram", { method: "DELETE" });
      setStatus({ linked: false });
      toast.success("Telegram unlinked");
    } catch {
      toast.error("Failed to unlink");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-neo-gray flex items-center justify-center">
        <div className="neo-card p-8 text-center">
          <p className="font-bold text-lg">Login dulu untuk mengakses halaman ini.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neo-gray p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Bot className="w-8 h-8" />
          <h1 className="font-bold text-3xl">TELEGRAM BOT</h1>
        </div>

        <div className="neo-card p-6">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Status Koneksi
          </h2>

          {loading ? (
            <p className="font-mono text-sm">Loading...</p>
          ) : status?.linked ? (
            <div className="space-y-4">
              <div className="bg-green-100 border-3 border-neo-black p-4">
                <p className="font-bold text-green-800">Terhubung</p>
                <p className="font-mono text-sm mt-1">
                  Telegram ID: {status.telegram_id}
                </p>
                {status.telegram_username && (
                  <p className="font-mono text-sm">
                    Username: @{status.telegram_username}
                  </p>
                )}
              </div>
              <button
                onClick={handleUnlink}
                className="neo-btn bg-neo-red text-white flex items-center gap-2"
              >
                <Unlink className="w-4 h-4" />
                Unlink Telegram
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-100 border-3 border-neo-black p-4">
                <p className="font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Belum Terhubung
                </p>
                <p className="text-sm mt-2">
                  Link akun NESTI kamu dengan Telegram Bot untuk menerima
                  laporan monitoring dan chat AI langsung dari Telegram.
                </p>
              </div>

              <div className="bg-neo-blue border-3 border-neo-black p-4">
                <p className="font-bold mb-2">Cara Link:</p>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Buka Telegram, search <span className="font-mono font-bold">@nesti_security_bot</span></li>
                  <li>Ketik <span className="font-mono font-bold">/start</span></li>
                  <li>Ketik <span className="font-mono font-bold">/link {user.email}</span></li>
                  <li>Bot akan mengkonfirmasi linkage</li>
                </ol>
              </div>

              <div className="bg-neo-purple border-3 border-neo-black p-4 text-white">
                <p className="font-bold mb-2">Commands Tersedia:</p>
                <div className="text-sm space-y-1 font-mono">
                  <p>/ai {'<pesan>'} - Chat AI (5/hari)</p>
                  <p>/laporan - Laporan monitoring (5/hari)</p>
                  <p>/scan {'<url>'} - Scan website (5/hari)</p>
                  <p>/status - Status monitoring</p>
                  <p>/help - Bantuan</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="neo-card p-6">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Limit Harian
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-neo-yellow border-3 border-neo-black p-4 text-center">
              <p className="font-bold text-2xl">5</p>
              <p className="text-xs font-bold">AI Chat</p>
            </div>
            <div className="bg-neo-pink border-3 border-neo-black p-4 text-center">
              <p className="font-bold text-2xl">5</p>
              <p className="text-xs font-bold">Laporan</p>
            </div>
            <div className="bg-neo-green border-3 border-neo-black p-4 text-center">
              <p className="font-bold text-2xl">5</p>
              <p className="text-xs font-bold">Scan</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
