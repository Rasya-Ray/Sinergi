import os
import asyncio
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
                    context_parts.append(f"[{f.get('severity','?')}] {f.get('detail','')[:60]}")
            if scan.get("security_headers"):
                missing = [h for h, v in scan["security_headers"].items() if not v]
                if missing:
                    context_parts.append(f"Missing: {', '.join(missing[:5])}")

        history_text = ""
        for item in messages[-4:]:
            role = "U" if item.get("role") == "user" else "N"
            history_text += f"{role}: {item.get('content', '')[:100]}\n"

        user_name = getattr(req, "user_name", None) or "User"

        prompt_parts = []
        prompt_parts.append(f"Short concise replies. User: {user_name}.")
        if context_parts:
            prompt_parts.append("Scan:\n" + "\n".join(context_parts))
        if history_text:
            prompt_parts.append("History:\n" + history_text)
        prompt_parts.append(f"{user_name}: {last_msg}")

        full_prompt = "\n".join(prompt_parts)

        try:
            reply = await self._call_openclaw(full_prompt)
            if reply and len(reply.strip()) > 3:
                return ChatResponse(reply=reply.strip(), session_id=req.context.get("session_id", ""), model="nesti-openclaw", provider="openclaw")
        except Exception:
            pass

        reply = self._smart_fallback(last_msg, context_parts)
        return ChatResponse(reply=reply, session_id=req.context.get("session_id", ""), model="nesti-fallback", provider="fallback")

    async def _call_openclaw(self, message: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            self.openclaw_bin, "agent", "--agent", self.agent_id, "-m", message,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)
        if proc.returncode == 0 and stdout:
            output = stdout.decode().strip()
            if "GatewayClientRequestError" in output or "rate_limit" in output:
                raise RuntimeError("Rate limited")
            return output
        raise RuntimeError("OpenClaw failed")

    def _smart_fallback(self, message: str, context: list) -> str:
        msg = message.lower()

        if context:
            lines = ["Berdasarkan data scan:"]
            for c in context:
                lines.append(f"  {c}")
            lines.append("\nTanya spesifik soal findings, TLS, DNS, atau headers.")
            return "\n".join(lines)

        if any(w in msg for w in ["hello", "hi", "hey", "halo", "hai"]):
            return "Halo! Gw Nesti, AI Security Analyst. Gw bisa bantu scan website, cek DNS/TLS, analisis headers, dan bikin laporan. Mau mulai dari mana?"

        if any(w in msg for w in ["dns", "domain", "record"]):
            return "Kasih domain-nya, nanti gw cek semua DNS record: A, AAAA, MX, NS, TXT, CNAME, SPF, DMARC."

        if any(w in msg for w in ["tls", "ssl", "cert"]):
            return "Kasih domain-nya, nanti gw cek TLS/SSL: validity, expiry, issuer, TLS version, cipher suite."

        if any(w in msg for w in ["scan", "cek website"]):
            return "Masukin URL di halaman Scan, gw bakal analisis HTTP headers, TLS, DNS, dan technology fingerprinting."

        if any(w in msg for w in ["password", "pass"]):
            return "Masuk ke halaman Password Checker. Password lo gak disimpan, langsung keliatan strength & crack time."

        if any(w in msg for w in ["report", "laporan"]):
            return "Di halaman Reports lo bisa generate report dari scan. Export ke PDF, JSON, atau CSV."

        if any(w in msg for w in ["thank", "makasih"]):
            return "Sama-sama! Butuh bantuan lagi, tanya aja."

        return "Gw Nesti, AI Security Analyst. Ada yang mau lo tanyain soal keamanan website?"
