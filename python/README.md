# NESTI Backend

FastAPI service untuk security scanning, AI chat, dan Telegram bot.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Isi .env dengan credentials
python app.py
```

## Struktur

```
python/
├── app.py              # FastAPI app entry point
├── api/
│   └── routes.py       # API route handlers
├── config/
│   └── settings.py     # App configuration
├── schemas/
│   └── security.py     # Pydantic models
├── services/
│   ├── scanner.py      # Security scanner (async)
│   ├── chat.py         # AI chat via OpenClaw
│   ├── classifier.py   # Domain classifier
│   ├── dns_service.py  # DNS checker
│   ├── tls_service.py  # TLS checker
│   ├── password_service.py  # Password strength
│   ├── ai_service.py   # AI report styling
│   ├── tg_bot.py       # Telegram bot
│   └── tg_scheduler.py # Monitoring scheduler
├── monitor_runner.py   # Standalone monitor runner
└── requirements.txt    # Python dependencies
```

## API Endpoints

### Health
```
GET /health
Response: { status: "ok", service: "nesti-security-scanner", version: "3.0.0" }
```

### Scan
```
POST /scan
Body: { url: string }
Response: {
  url, headers, security_headers, tls_info,
  cookies, redirects, technologies, findings
}
Response Time: ~0.7s
```

### Classify
```
POST /classify
Body: { domain: string }
Response: { category, confidence, ... }
```

### DNS Check
```
POST /dns-check
Body: { domain: string }
Response: { records: { A, AAAA, MX, TXT, NS, ... } }
```

### TLS Check
```
POST /tls-check
Body: { domain: string }
Response: { valid, issuer, expiry, version, ... }
```

### Password Check
```
POST /password-check
Body: { password: string }
Response: { strength, score, crack_time, length, entropy, ... }
```

### Chat (AI)
```
POST /chat
Body: {
  messages: [{ role, content }],
  context: { user_id, session_id },
  user_name: string (optional)
}
Response: { reply, session_id, model, provider }
```

### Style Report
```
POST /style-report
Body: { findings, target_url, scan_data }
Response: { styled_report }
```

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/link <email>` | Link Telegram ke akun NESTI |
| `/unlink` | Unlink akun Telegram |
| `/help` | Tampilkan semua command |
| `/ai <pesan>` | Chat AI security analyst |
| `/scan <url>` | Scan website |
| `/laporan` | Laporan monitoring |
| `/status` | Status monitoring |

## Rate Limits

- AI Chat: 10/ jam
- Reports: 10/ jam
- Scans: 10/ jam

## Environment Variables

Lihat `.env.example` untuk lengkap.

Key variables:
- `DATABASE_URL` - NeonDB connection string
- `NESTI_API_KEY` - API key untuk Next.js
- `OPENCLAW_BIN` - OpenClaw binary path
- `OPENCLAW_AGENT_ID` - Agent ID (default: nesti)
- `TG_BOT_TOKEN` - Telegram bot token
