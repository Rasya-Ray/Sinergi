import os
import subprocess
import json
from schemas.security import ChatRequest, ChatResponse


class ChatService:
    def __init__(self):
        self.openclaw_bin = os.getenv("OPENCLAW_BIN", "openclaw")
        self.agent_id = os.getenv("NESTI_AGENT_ID", "nesti")

    async def chat(self, req: ChatRequest) -> ChatResponse:
        messages = req.messages or []
        if not messages and req.message:
            messages = [{"role": "user", "content": req.message}]

        last_msg = messages[-1].get("content", "") if messages else ""

        context_parts = []
        if req.scan_context:
            scan = req.scan_context
            if scan.get("findings"):
                for f in scan["findings"][:3]:
                    context_parts.append(f"[{f.get('severity','?')}] {f.get('detail','')}")
            if scan.get("security_headers"):
                missing = [h for h, v in scan["security_headers"].items() if not v]
                if missing:
                    context_parts.append(f"Missing headers: {', '.join(missing[:5])}")

        history_text = ""
        for item in messages[-6:]:
            role = "User" if item.get("role") == "user" else "Nesti"
            history_text += f"{role}: {item.get('content', '')}\n"

        user_name = getattr(req, "user_name", None) or "User"

        prompt_parts = []
        prompt_parts.append(f"You are speaking with {user_name}. Address them by name. Be concise and helpful.")
        if context_parts:
            prompt_parts.append("Security scan data:\n" + "\n".join(context_parts))
        if history_text:
            prompt_parts.append("Conversation history:\n" + history_text)
        prompt_parts.append(f"{user_name}: {last_msg}")

        full_prompt = "\n\n".join(prompt_parts)

        try:
            reply = await self._call_openclaw(full_prompt)
            if reply and len(reply.strip()) > 5:
                return ChatResponse(reply=reply.strip(), session_id=req.context.get("session_id", ""), model="nesti-openclaw", provider="openclaw")
        except Exception as e:
            pass

        reply = self._smart_fallback(last_msg, context_parts)
        return ChatResponse(reply=reply, session_id=req.context.get("session_id", ""), model="nesti-fallback", provider="fallback")

    async def _call_openclaw(self, message: str) -> str:
        result = subprocess.run(
            [self.openclaw_bin, "agent", "--agent", self.agent_id, "-m", message],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0 and result.stdout.strip():
            output = result.stdout.strip()
            if "GatewayClientRequestError" in output or "rate_limit" in output or "Rate limit" in output:
                raise RuntimeError("Rate limited")
            return output
        raise RuntimeError("OpenClaw failed")

    def _smart_fallback(self, message: str, context: list) -> str:
        msg = message.lower()

        if context:
            lines = []
            lines.append("Berdasarkan data scan yang tersedia:")
            for c in context:
                lines.append(f"• {c}")
            lines.append("\nMau analisis lebih lanjut? Tanya spesifik soal findings, TLS, DNS, atau security headers.")
            return "\n".join(lines)

        if any(w in msg for w in ["hello", "hi", "hey", "halo", "hai", "who", "siapa", "apa"]):
            return "Halo! Gw Nesti, AI Web Security Analyst. Gw bisa bantu:\n• Scan website buat cari masalah keamanan\n• Cek DNS record & TLS/SSL certificate\n• Analisis security headers\n• Bikin laporan security\n• Cek kekuatan password\n\nMau mulai dari mana?"

        if any(w in msg for w in ["dns", "domain", "record", "nameserver", "mx "]):
            return "Mau cek DNS? Kasih domain-nya, nanti gw cek semua record: A, AAAA, MX, NS, TXT, CNAME, CAA, SPF, DMARC, DNSSEC.\n\nKetik domain-nya aja, misal: google.com"

        if any(w in msg for w in ["tls", "ssl", "certificate", "cert", "expiry"]):
            return "Mau cek TLS/SSL? Kasih domain-nya, nanti gw cek:\n• Certificate validity & expiry\n• Issuer & subject\n• TLS version\n• Certificate chain\n• Cipher suite\n\nKetik domain-nya aja."

        if any(w in msg for w in ["scan", "analyze", "periksa", "cek website"]):
            return "Mau scan website? Masukin URL di halaman Scan, nanti gw bakal analisis:\n• HTTP headers & security headers\n• TLS/SSL certificate\n• DNS records\n• Technology fingerprinting\n• Security findings\n\nSemua hasil disimpen di history lo."

        if any(w in msg for w in ["password", "pass", "pw"]):
            return "Mau cek password? Masuk ke halaman Password Checker, langsung keliatan:\n• Strength (Strong/Weak)\n• Waktu brute force\n• Yang perlu diperbaiki\n\nPassword lo gak disimpan."

        if any(w in msg for w in ["report", "laporan"]):
            return "Mau bikin laporan security? Di halaman Reports lo bisa generate report dari scan results. Pilih:\n• Full Assessment\n• Technical Report\n• Executive Report\n\nExport ke PDF, JSON, atau CSV."

        if any(w in msg for w in ["thank", "thanks", "makasih"]):
            return "Sama-sama! Kalau butuh bantuan lagi, tanya aja."

        return "Gw Nesti, AI Security Analyst. Ada yang mau lo tanyain soal keamanan website? Tanya aja langsung."
