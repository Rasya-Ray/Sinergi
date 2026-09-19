# NESTI Frontend

Next.js application dengan Firebase Authentication dan neo-brutalism UI.

## Setup

```bash
npm install
cp .env.example .env
# Isi .env dengan credentials
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Struktur

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/        # Security analysis endpoint
│   │   ├── auth/            # Auth check & sync
│   │   ├── chat/            # AI chat endpoint
│   │   ├── history/         # Scan history
│   │   ├── messages/        # Chat messages
│   │   ├── monitoring/      # Monitoring CRUD
│   │   ├── password-check/  # Password strength check
│   │   ├── reports/         # Reports + PPT export
│   │   ├── scan/            # Website scan
│   │   ├── sessions/        # Chat sessions CRUD
│   │   └── user/            # User profile + limits
│   ├── chat/                # AI Chat page
│   ├── history/             # Scan history page
│   ├── login/               # Login page
│   ├── monitoring/          # Monitoring dashboard
│   ├── register/            # Register page
│   ├── reports/             # Reports page
│   ├── scan/                # Security scan page
│   ├── telegram/            # Telegram link page
│   └── tools/password/      # Password analyzer
├── components/
│   ├── ChatBot.tsx          # Floating chat widget
│   ├── HeroIntro.tsx        # Scroll-driven intro animation
│   ├── NestiLogo.tsx        # SVG logo component
│   ├── Navbar.tsx           # Navigation bar
│   └── IntroWrapper.tsx     # Intro overlay (unused)
└── lib/
    ├── api.ts               # Auth fetch wrapper
    ├── auth-context.tsx     # Firebase auth context
    ├── db.ts                # PostgreSQL connection
    └── firebase.ts          # Firebase config
```

## API Endpoints (Internal)

### Scan
```
POST /api/scan
Body: { url: string }
Response: { scan_id, findings, security_headers, ... }
```

### Chat
```
POST /api/chat
Body: { session_id: string, content: string }
Headers: x-firebase-uid: <uid>
Response: { reply: string }
```

### Sessions
```
GET    /api/sessions          # List sessions
POST   /api/sessions          # Create session
DELETE /api/sessions          # Delete session
```

### User
```
GET    /api/user/profile      # Get profile
PATCH  /api/user/profile      # Update profile
GET    /api/user/limits       # Get hourly limits
```

### Reports
```
GET  /api/reports             # List reports
POST /api/reports             # Create report
POST /api/reports/export      # Export PPT
```

## Environment Variables

Lihat `.env.example` untuk lengkap.

Key variables:
- `DATABASE_URL` - NeonDB connection string
- `FIREBASE_SERVICE_ACCOUNT` - Firebase admin JSON
- `NESTI_PYTHON_URL` - Python API URL (http://127.0.0.1:8090)
- `NESTI_PYTHON_API_KEY` - API key untuk Python service
