#!/usr/bin/env node
const { Client } = require("pg");
const readline = require("readline");

const DB_URL = process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_Zd4mRIq9PCjk@ep-square-hill-b3y1avud-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const TABLES = [
  "tg_hourly_limits","tg_chat_sessions","community_messages",
  "chat_messages","chat_sessions","alerts","reports",
  "scans","monitoring","password_checks","ppt_rate_limits",
  "monitoring_history","analyses","messages","sessions","users",
];

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255), email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255), firebase_uid VARCHAR(255) UNIQUE,
  telegram_id BIGINT UNIQUE, telegram_username VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE monitoring (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL, status VARCHAR(50) DEFAULT 'active',
  check_type VARCHAR(50) DEFAULT 'full',
  schedule VARCHAR(100), schedule_type VARCHAR(50),
  schedule_interval_minutes INTEGER,
  schedule_hour INTEGER DEFAULT 0, schedule_minute INTEGER DEFAULT 0,
  schedule_day INTEGER DEFAULT 0, schedule_month INTEGER DEFAULT 0,
  schedule_weekday INTEGER DEFAULT 1,
  last_run TIMESTAMPTZ, next_run TIMESTAMPTZ, updated_at TIMESTAMPTZ DEFAULT NOW(),
  previous_result JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  raw_data JSONB DEFAULT '{}',
  findings JSONB DEFAULT '[]', technologies JSONB DEFAULT '[]',
  headers JSONB DEFAULT '{}', security_headers JSONB DEFAULT '{}',
  tls_info JSONB DEFAULT '{}', cookies JSONB DEFAULT '[]',
  redirects JSONB DEFAULT '[]', dns_info JSONB DEFAULT '{}',
  tls_check_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  scan_id UUID, target_url TEXT, report_type VARCHAR(50),
  title TEXT, content JSONB DEFAULT '{}',
  summary TEXT, risk_level VARCHAR(50),
  version INTEGER DEFAULT 1, parent_report_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  monitoring_id INTEGER REFERENCES monitoring(id) ON DELETE CASCADE,
  alert_type VARCHAR(50), message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE chat_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) DEFAULT 'New Session',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT, content TEXT, metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID, user_id UUID, target_url TEXT, summary TEXT,
  findings_analyzed JSONB DEFAULT '[]', correlations JSONB DEFAULT '[]',
  information_leakage JSONB DEFAULT '[]', improvements JSONB DEFAULT '[]',
  severity_summary JSONB DEFAULT '{}', risk_explanation TEXT,
  raw_analysis TEXT, model_used TEXT, tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE monitoring_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id INTEGER, user_id UUID,
  scan_data JSONB DEFAULT '{}', dns_data JSONB DEFAULT '{}',
  tls_data JSONB DEFAULT '{}', changes_detected JSONB DEFAULT '[]',
  status TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE password_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, strength_score INTEGER, crack_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE ppt_rate_limits (
  id SERIAL PRIMARY KEY,
  user_id UUID, export_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE tg_chat_sessions (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE tg_hourly_limits (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  hour_start TIMESTAMPTZ NOT NULL,
  ai_chat_count INTEGER DEFAULT 0, report_count INTEGER DEFAULT 0,
  scan_count INTEGER DEFAULT 0, UNIQUE(user_id, hour_start)
);
CREATE TABLE community_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(255), message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q) { return new Promise(r => rl.question(q, r)); }

async function main() {
  console.log("NESTI DATABASE RESET (Full Schema)\n");
  const a = await ask("Type 'yes' to reset: ");
  if (a.trim().toLowerCase() !== "yes") { console.log("Cancelled."); rl.close(); return; }
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    for (const t of TABLES) { await c.query(`DROP TABLE IF EXISTS ${t} CASCADE`); console.log(`  Dropped: ${t}`); }
    await c.query(SCHEMA);
    console.log("\nAll tables recreated with full schema!");
  } catch (e) { console.error("Error:", e.message); }
  finally { await c.end(); rl.close(); }
}
main();
