# NESTI — AI Web Security Analyst

> Dokumentasi lengkap arsitektur, cara kerja, dan teknologi yang digunakan oleh NESTI.

---

## Table of Contents

1. [Tentang NESTI](#tentang-nesti)
2. [Arsitektur Sistem](#arsitektur-sistem)
3. [Tech Stack](#tech-stack)
4. [Cara Kerja](#cara-kerja)
5. [AI Engine: OpenClaw](#ai-engine-openclaw)
6. [Database Schema](#database-schema)
7. [Telegram Bot](#telegram-bot)
8. [Monitoring System](#monitoring-system)
9. [Service Architecture](#service-architecture)
10. [Deployment](#deployment)

---

## Tentang NESTI

**NESTI** (Nesti Security) adalah platform **AI Web Security Analyst** yang menggabungkan automated scanning dengan AI-powered analysis untuk menganalisis keamanan website.

### Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| **Security Scan** | Full HTTP header analysis, TLS/SSL check, DNS records, technology fingerprinting, vulnerability detection |
| **AI Chat** | Chat dengan AI security analyst untuk analisis findings dan rekomendasi |
| **Monitoring** | Scheduled recurring scans (hourly, daily, weekly, monthly) dengan change detection |
| **Reports** | Generate laporan keamanan dalam format PDF, Excel, Word, PowerPoint |
| **Community** | Community chat untuk berbagi hasil scan |
| **Password Checker** | Analisis kekuatan password tanpa menyimpan data |

### Prinsip Desain

```
Python collects. Nesti thinks. Nesti analyzes. Nesti explains. Nesti recommends.
```

- **Python Scanner** bertanggung jawab mengumpulkan data (HTTP, DNS, TLS)
- **Nesti AI** bertanggung jawab menganalisis, mengkorelasi findings, dan memberikan rekomendasi
- ~70% nilai sistem berasal dari analisis AI, bukan sekadar data mentah

---

## Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                     USER LAYER                              │
│  Browser (Web App)          │      Telegram Bot             │
└──────────┬──────────────────┴──────────────┬───────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────┐      ┌──────────────────────────────┐
│   NEXT.JS (port 3000)│      │   FASTAPI (port 8090)        │
│   ┌────────────────┐ │      │   ┌────────────────────────┐ │
│   │ React Frontend │ │      │   │ Python Scanner         │ │
│   │ + API Routes   │─┼──────┼──▶│ + Telegram Bot         │ │
│   │ + Firebase Auth│ │      │   │ + OpenClaw Agent       │ │
│   └────────────────┘ │      │   └────────────────────────┘ │
└──────────┬───────────┘      └──────────────┬───────────────┘
           │                                  │
           └──────────────┬───────────────────┘
                          ▼
              ┌──────────────────────┐
              │   NEONDB (PostgreSQL)│
              │   16 tables          │
              └──────────────────────┘
```

### Alur Request

1. **User** mengakses web app atau kirim pesan di Telegram
2. **Next.js** mengautentikasi user via Firebase, lalu proxy request ke Python backend
3. **Python FastAPI** menjalankan scan, query DNS/TLS, atau memanggil OpenClaw AI
4. **OpenClaw** menerima prompt, menghasilkan analisis, mengembalikan response
5. **NeonDB** menyimpan semua data (users, scans, reports, monitoring)

---

## Tech Stack

### Frontend — Next.js 15

| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| **Next.js** | ^15.5.25 | React framework (SSR, API routes, routing) |
| **React** | ^18.3.1 | UI library |
| **TypeScript** | ^5.9.3 | Type safety |
| **Tailwind CSS** | ^4.3.3 | Utility-first CSS |
| **Framer Motion** | ^13.4.0 | Animasi UI |
| **Lucide React** | ^1.47.0 | Icons |
| **Firebase Auth** | ^12.19.0 | Autentikasi (Google + Email) |
| **pg** | ^8.23.0 | PostgreSQL driver (server-side) |
| **react-hot-toast** | ^2.6.1 | Notifikasi |

**Report Generation (client-side):**
| Library | Format |
|---------|--------|
| pdfkit | PDF |
| exceljs | Excel (.xlsx) |
| docx | Word (.docx) |
| pptxgenjs | PowerPoint (.pptx) |

**Design System:** Neo-brutalism — hard borders, drop shadows, bright accent colors (neo-yellow, neo-pink, neo-cyan, neo-purple).

**Fonts:** Space Grotesk (sans) + JetBrains Mono (mono).

---

### Backend — FastAPI (Python 3.12)

| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| **FastAPI** | >=0.104.0 | REST API framework |
| **Uvicorn** | >=0.24.0 | ASGI server |
| **Pydantic** | >=2.0.0 | Request/response validation |
| **httpx** | >=0.25.0 | HTTP client (async) |
| **psycopg2-binary** | >=2.9.0 | PostgreSQL driver |
| **python-telegram-bot** | - | Telegram bot framework |
| **dnspython** | - | DNS resolution |
| **reportlab** | - | PDF generation |
| **openpyxl** | - | Excel generation |
| **python-docx** | - | Word generation |
| **python-pptx** | - | PowerPoint generation |

**Port:** 8090 (localhost only, proxied by Nginx).

---

### AI Engine — OpenClaw

| Setting | Value |
|---------|-------|
| **Framework** | OpenClaw (CLI agent framework) |
| **Agent ID** | `nesti` |
| **Model** | `z-ai/glm-5.3-flash` |
| **Provider** | OpenRouter (`openrouter.ai`) |
| **Context Window** | 131,072 tokens |
| **Max Output** | 8,192 tokens |
| **Cost** | Free (input: 0, output: 0) |

**Cara Panggil:**
```bash
openclaw agent --agent nesti --session-key <key> -m "<message>"
```

**Session Isolation:** Tiap user memiliki session terpisah berdasarkan platform:
- Web: `agent:nesti:web:<user_id>`
- Telegram: `agent:nesti:tg:<telegram_id>`

---

### Database — NeonDB (PostgreSQL)

| Setting | Value |
|---------|-------|
| **Provider** | NeonDB (serverless PostgreSQL) |
| **Region** | AWS ap-southeast-1 |
| **Driver (Python)** | psycopg2-binary |
| **Driver (Node.js)** | pg |
| **SSL** | Required (`sslmode=require`) |
| **Connection Pool** | ThreadedConnectionPool (2-10) |

---

## Cara Kerja

### 1. Security Scan

```
User Input (URL)
    │
    ▼
Next.js /api/scan
    │
    ├──▶ Python /scan     → HTTP headers, cookies, redirects, technologies, vulnerabilities
    ├──▶ Python /dns-check → DNS records (A, AAAA, MX, NS, TXT, CNAME, SPF, DMARC)
    └──▶ Python /tls-check → TLS certificate (validity, expiry, issuer, version)
    │
    ▼
Simpan ke NeonDB (scans table)
    │
    ▼
Kembalikan hasil ke frontend
```

**Security Checks yang dilakukan:**
- HTTP Security Headers (X-Frame-Options, CSP, HSTS, dll)
- TLS/SSL Certificate validation
- DNS record analysis
- Technology fingerprinting (server, framework, language)
- Cookie security (Secure, HttpOnly, SameSite)
- Redirect chain analysis
- Basic vulnerability detection (SQLi, XSS indicators, directory traversal, dll)

---

### 2. AI Chat

```
User: "analisis security findings website ini"
    │
    ▼
Next.js /api/chat
    │
    ├── Ambil history dari DB (messages table)
    ├── Bangun prompt: "User: Andi. History: ... Andi: analisis..."
    │
    ▼
Python /chat (ChatService)
    │
    ├── Bangun prompt lengkap dengan user_name, scan_context, history
    │
    ▼
OpenClaw Agent (subprocess)
    │
    ├── Session key: agent:nesti:web:<user_id> (isolated per user)
    ├── Model: z-ai/glm-5.3-flash via OpenRouter
    │
    ▼
Response ke user
```

---

### 3. Monitoring

```
Systemd Timer (setiap 1 jam)
    │
    ▼
monitor_runner.py
    │
    ├── Query NeonDB: SELECT * FROM monitoring WHERE next_run <= NOW()
    │
    ├── Untuk tiap monitor:
    │   ├── POST /scan → scan website
    │   ├── POST /dns-check → cek DNS
    │   ├── POST /tls-check → cek TLS
    │   ├── Bandingkan dengan previous_result (change detection)
    │   └── Simpan ke monitoring_history
    │
    └── Update next_run berdasarkan schedule_type
```

**Schedule Types:**
| Type | Interval |
|------|----------|
| `hourly` | Setiap jam |
| `every_6h` | Setiap 6 jam |
| `every_12h` | Setiap 12 jam |
| `daily` | Setiap hari (jam tertentu) |
| `weekly` | Setiap minggu (hari + jam tertentu) |
| `monthly` | Setiap bulan (tanggal + jam tertentu) |
| `yearly` | Setiap tahun (bulan + tanggal + jam tertentu) |

---

## AI Engine: OpenClaw

### Konfigurasi Agent

**File:** `/root/.openclaw/agents/nesti/agent/models.json`
```json
{
  "providers": {
    "openrouter": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "models": [{
        "id": "z-ai/glm-5.3-flash",
        "contextWindow": 131072,
        "maxTokens": 8192,
        "cost": {"input": 0, "output": 0}
      }]
    }
  }
}
```

### Agent Identity

**File:** `/root/.openclaw/workspace-nesti/IDENTITY.md`
- **Name:** Nesti
- **Emoji:** 🔍
- **Role:** AI Web Security Analyst

### Agent Personality (SOUL.md)

- **Bahasa:** Indonesia (Bahasa Indonesia)
- **Karakter:** Langsung, teknis tapi mudah dipahami, evidence-based
- **Fokus:** Defensive security analyst
- **Severity Levels:** LOW, MEDIUM, HIGH

### Analysis Workflow

```
1. Understand target
2. Understand raw evidence
3. Identify findings
4. Identify information leakage
5. Correlate findings
6. Assess potential impact
7. Determine severity
8. Determine priority
9. Recommend improvements
10. Explain result
```

### Output Format

```
Finding   — Apa yang ditemukan
Evidence  — Data yang mendukung
Risk      — Kenapa penting
Impact    — Apa yang mungkin terjadi
Recommendation — Apa yang harus diperbaiki
Priority  — Seberapa penting dibanding finding lain
```

---

## Database Schema

### 16 Tables

| Table | Fungsi | Key Columns |
|-------|--------|-------------|
| `users` | Akun user | firebase_uid, email, name, telegram_id |
| `sessions` | Chat sessions | user_id, title |
| `messages` | Chat messages | session_id, role, content |
| `scans` | Hasil scan | target_url, findings (JSONB), technologies, headers, tls_info, dns_info |
| `analyses` | Hasil analisis AI | findings_analyzed, correlations, risk_explanation |
| `monitoring` | Scheduled monitors | target_url, schedule_type, next_run, previous_result |
| `monitoring_history` | History monitoring | scan_data, dns_data, tls_data, changes_detected |
| `reports` | Laporan | report_type, content (JSONB), version |
| `alerts` | Monitoring alerts | — |
| `password_checks` | Password strength | — |
| `ppt_rate_limits` | Rate limiting PPT | — |
| `chat_sessions` | Legacy chat sessions | — |
| `chat_messages` | Legacy chat messages | — |
| `tg_chat_sessions` | Link Telegram-user | telegram_id, user_id |
| `tg_hourly_limits` | Limit per jam Telegram | user_id, ai_chat_count, report_count, scan_count |
| `community_messages` | Community chat | — |

### Relasi

```
users (1) ──▶ (N) sessions ──▶ (N) messages
users (1) ──▶ (N) scans
users (1) ──▶ (N) analyses
users (1) ──▶ (N) monitoring ──▶ (N) monitoring_history
users (1) ──▶ (N) reports
users (1) ──▶ (N) tg_chat_sessions
users (1) ──▶ (N) tg_hourly_limits
```

---

## Telegram Bot

### Library
`python-telegram-bot` — async Telegram bot framework.

### Commands

| Command | Fungsi | Contoh |
|---------|--------|--------|
| `/start` | Welcome message | `/start` |
| `/link <email>` | Link akun NESTI | `/link user@gmail.com` |
| `/unlink` | Unlink akun | `/unlink` |
| `/reset` | Hapus semua data | `/reset yes` |
| `/whoami` | Info akun | `/whoami` |
| `/help` | List commands | `/help` |
| `/ai <pesan>` | Chat AI | `/ai scan example.com` |
| `/stopai` | Keluar AI mode | `/stopai` |
| `/scan <url>` | Scan website | `/scan example.com` |
| `/status` | Status monitoring | `/status` |
| `/laporan` | Laporan monitoring | `/laporan` |
| `/report <num> <fmt>` | Download report | `/report 1 pdf` |

### Hourly Limits
- AI Chat: **10/hour**
- Reports: **10/hour**
- Scans: **10/hour**

### Report Formats
- PDF (reportlab)
- Excel (openpyxl)
- Word (python-docx)
- PowerPoint (python-pptx) — dengan 3 themes: cyberpunk, neo-brutalism, cherry-blossom

---

## Monitoring System

### Komponen

1. **`nesti-monitor.timer`** — Systemd timer, trigger setiap 1 jam
2. **`nesti-monitor.service`** — Oneshot service, menjalankan `monitor_runner.py`
3. **`monitor_runner.py`** — Script utama monitoring

### Flow

```
Timer (1 jam) → monitor_runner.py → Query DB → Scan → Compare → Save → Notify
```

### Change Detection

Sistem membandingkan hasil scan saat ini dengan `previous_result` yang tersimpan:

| Check | Deteksi |
|-------|---------|
| Server header | Perubahan server (nginx → apache) |
| TLS certificate | Perubahan expiry, version |
| DNS records | Perubahan A, AAAA records |
| Findings | New findings, resolved findings |

---

## Service Architecture

### Systemd Services

| Service | Type | Port | Fungsi |
|---------|------|------|--------|
| `nesti-nextjs` | simple | 3000 | Next.js frontend + API routes |
| `nesti-scanner` | simple | 8090 | FastAPI + Telegram bot + Scanner |
| `nesti-monitor` | oneshot | — | Monitoring cron (via timer) |
| `nesti-monitor.timer` | timer | — | Trigger monitor tiap 1 jam |

### Dependency

```
nesti-scanner.service (port 8090)
    │
    ▼
nesti-nextjs.service (port 3000)
    │
    ▼
nginx (port 80/443) → reverse proxy ke Next.js
```

### Service Files

```
service/
├── nesti-scanner.service     # Python FastAPI + Telegram bot
├── nesti-nextjs.service      # Next.js frontend
├── nesti-monitor.service     # Monitoring cron
└── nesti-monitor.timer       # Hourly timer
```

---

## Deployment

### Server
- **OS:** Ubuntu 24
- **VPS:** OpenClaw infrastructure
- **Reverse Proxy:** Nginx (port 80/443)

### Nginx Config
- `/etc/nginx/sites-available/nesti` — Reverse proxy ke Next.js (port 3000)
- Static files served by Nginx
- API calls proxied to Next.js, which then proxies to Python backend

### Environment Variables

**Python (`.env`):**
```
DATABASE_URL=postgresql://...
TG_BOT_TOKEN=8905303582:AAH...
OPENCLAW_BIN=openclaw
NESTI_AGENT_ID=nesti
NESTI_PYTHON_URL=http://127.0.0.1:8090
```

**Next.js (`.env`):**
```
DATABASE_URL=postgresql://...
NESTI_PYTHON_URL=http://127.0.0.1:8090
FIREBASE_*=...
```

### Scripts

| Script | Fungsi |
|--------|--------|
| `scripts/reset_db.py` | Reset database (dynamic, auto-discover tables) |
| `scripts/reset_tg_bot.py` | Reset Telegram bot data |
| `scripts/reset_db.js` | Legacy DB reset (Node.js) |

---

## API Endpoints

### Python FastAPI (port 8090)

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| GET | `/health` | Health check |
| POST | `/scan` | Full security scan |
| POST | `/dns-check` | DNS record lookup |
| POST | `/tls-check` | TLS certificate check |
| POST | `/password-check` | Password strength analysis |
| POST | `/classify` | Domain risk classification |
| POST | `/chat` | AI chat via OpenClaw |
| POST | `/ai/style` | AI PPT style generation |

### Next.js API Routes (port 3000)

| Endpoint | Fungsi |
|----------|--------|
| `/api/auth/sync` | Sync Firebase user ke NeonDB |
| `/api/auth/check-email` | Cek email exists |
| `/api/scan` | Proxy scan ke Python |
| `/api/chat` | Proxy chat ke Python |
| `/api/analyze` | Analisis findings |
| `/api/monitoring` | CRUD monitoring |
| `/api/monitoring/history` | History monitoring |
| `/api/reports` | Reports |
| `/api/reports/export` | Export report |
| `/api/history` | Scan history |
| `/api/user/telegram` | Telegram link status |
| `/api/user/limits` | Hourly usage limits |

---

## Performance Optimizations

### Connection Pooling
- **Python:** `ThreadedConnectionPool(2, 10)` — reuse DB connections
- **Node.js:** `pg.Pool` — connection pooling

### User Cache
- In-memory cache untuk user lookups (dict `{tg_id: user_info}`)
- Invalidasi otomatis pada link/unlink/reset

### Session Isolation
- Per-user OpenClaw session keys
- Prevent session mixing antar user

### Response Optimization
- ANSI escape code stripping dari OpenClaw output
- Log line filtering (hanya response murni)
- Timeout handling (30s untuk AI responses)

---

## Troubleshooting

### Bot tidak merespon
```bash
journalctl -u nesti-scanner -f
systemctl restart nesti-scanner
```

### AI session mixing (nama user salah)
- Pastikan `--session-key` ada di `call_openclaw`
- Hapus USER.md dari OpenClaw workspace
- Clear old sessions: `rm ~/.openclaw/agents/nesti/sessions/*.jsonl`

### Database error
```bash
python3 ~/NESTI/scripts/reset_db.py
systemctl restart nesti-scanner nesti-nextjs
```

### Monitoring tidak jalan
```bash
systemctl status nesti-monitor.timer
systemctl start nesti-monitor.timer
python3 ~/NESTI/python/monitor_runner.py  # test manual
```

---

## Folder Structure

```
NESTI/
├── nextjs/                    # Frontend (Next.js 15)
│   ├── src/app/               # Pages + API routes
│   ├── src/components/        # React components
│   └── src/lib/               # Firebase, DB, auth
│
├── python/                    # Backend (FastAPI)
│   ├── app.py                 # Entry point
│   ├── api/routes.py          # API endpoints
│   ├── services/              # Business logic
│   │   ├── scanner.py         # Security scanner
│   │   ├── chat.py            # AI chat service
│   │   ├── tg_bot.py          # Telegram bot
│   │   └── report_gen.py      # Report generation
│   └── monitor_runner.py      # Monitoring cron
│
├── scripts/                   # Utility scripts
│   ├── reset_db.py            # Dynamic DB reset
│   └── reset_tg_bot.py        # Telegram bot reset
│
└── service/                   # Systemd service files
    ├── nesti-scanner.service
    ├── nesti-nextjs.service
    ├── nesti-monitor.service
    └── nesti-monitor.timer
```

---

*Dokumentasi ini dihasilkan pada 20 September 2026.*
*NESTI v3.0 — AI Web Security Analyst.*
