import os
import subprocess
import json
import re


class AIService:
    def __init__(self):
        self.openclaw_bin = os.getenv("OPENCLAW_BIN", "openclaw")
        self.agent_id = os.getenv("NESTI_AGENT_ID", "nesti")

    def generate_ppt_style(self, prompt: str) -> dict | None:
        ai_prompt = (
            f'You are a PPT style designer. The user wants: "{prompt}"\n\n'
            "Return ONLY a valid JSON object (no markdown code fences, no explanation, just the raw JSON):\n"
            '{"bgColor":"hex without #","titleColor":"hex without #","textColor":"hex without #",'
            '"accentColor":"hex without #","fontFamily":"font name","titleSize":number,'
            '"layout":"centered" or "left-aligned"}\n\n'
            'Example for "pink corporate": {"bgColor":"1a0a2e","titleColor":"ff69b4","textColor":"ffffff",'
            '"accentColor":"ff1493","fontFamily":"Arial","titleSize":44,"layout":"centered"}\n\n'
            "Return ONLY the JSON."
        )
        try:
            result = subprocess.run(
                [self.openclaw_bin, "agent", "--agent", self.agent_id, "-m", ai_prompt],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode != 0 or not result.stdout.strip():
                return None

            output = result.stdout.strip()
            if "GatewayClientRequestError" in output or "error" in output.lower()[:50]:
                return None

            cleaned = re.sub(r"[\r\n\t`]", "", output).strip()
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if not match:
                return None

            parsed = json.loads(match.group())
            if not parsed.get("bgColor") or not parsed.get("titleColor"):
                return None

            def strip_hex(h):
                return h.lstrip("#") if isinstance(h, str) else h

            def parse_num(v, fallback):
                if isinstance(v, (int, float)):
                    return int(v)
                n = int(re.sub(r"[^0-9]", "", str(v)))
                return n if n else fallback

            return {
                "bgColor": strip_hex(parsed["bgColor"]),
                "titleColor": strip_hex(parsed["titleColor"]),
                "textColor": strip_hex(parsed.get("textColor", "FFFFFF")),
                "accentColor": strip_hex(parsed.get("accentColor", "4ecdc4")),
                "fontFamily": parsed.get("fontFamily", "Arial"),
                "titleSize": parse_num(parsed.get("titleSize"), 48),
                "layout": parsed.get("layout", "centered"),
            }
        except Exception:
            return None
