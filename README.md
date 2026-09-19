# NESTI - AI Web Security Analyst

Platform keamanan website berbasis AI dengan fitur scanning, monitoring, dan laporan otomatis.

## Struktur

```
NESTI/
├── nextjs/          # Frontend (Next.js + Firebase Auth)
├── python/          # Backend Scanner + Telegram Bot (FastAPI)
├── servis/          # Systemd service files backup
├── logo-nesti.png   # Logo NESTI
├── check.txt        # Service commands reference
└── README.md        # Dokumentasi ini
```

## Tech Stack

- **Frontend**: Next.js 15, Tailwind CSS, Framer Motion, Firebase Auth
- **Backend**: Python 3.12, FastAPI, Uvicorn
- **Database**: NeonDB (PostgreSQL)
- **AI**: OpenClaw Agent
- **Bot**: Telegram Bot (python-telegram-bot)
- **Hosting**: VPS Ubuntu 24

## Quick Start

```bash
# Install Next.js
cd nextjs && npm install && npm run build

# Install Python
cd python && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# Setup environment
cp nextjs/.env.example nextjs/.env
cp python/.env.example python/.env
# Isi .env dengan credentials masing-masing

# Run services
systemctl restart nesti-nextjs
systemctl restart nesti-scanner
```

## Endpoints

| Service | Port | URL |
|---------|------|-----|
| Next.js | 3000 | http://localhost:3000 |
| Python API | 8090 | http://localhost:8090 |
| Health Check | 8090 | http://localhost:8090/health |

## Fitur

- **Security Scan** - Analisis header, TLS, DNS, cookie, redirect
- **AI Chat** - Konsultasi keamanan dengan AI agent
- **Monitoring** - Auto-scan berkala dengan notifikasi
- **Reports** - Laporan PPT dengan AI styling
- **Telegram Bot** - Scan, chat AI, laporan via Telegram
- **Password Tool** - Analisis kekuatan password

## Service Commands

Lihat `check.txt` untuk lengkap.
