#!/usr/bin/env node
/**
 * NESTI Database Reset Script (Node.js)
 * UUID for core tables, SERIAL for internal
 * Run: node scripts/reset_db.js
 */

const { Client } = require("pg");

const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_Zd4mRIq9PCjk@ep-square-hill-b3y1avud-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const TABLES = [
  "tg_hourly_limits", "tg_chat_sessions", "community_messages",
  "chat_messages", "chat_sessions", "alerts", "reports",
  "scans", "monitoring", "users",
];

const CREATE_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  firebase_uid VARCHAR(255) UNIQUE,
  telegram_id BIGINT UNIQUE,
  telegram_username VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE monitoring (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  schedule VARCHAR(100),
  schedule_type VARCHAR(50),
  schedule_interval_minutes INTEGER,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  findings JSONB DEFAULT '[]',
  security_headers JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  report_type VARCHAR(50),
  target_url TEXT,
  content JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  monitoring_id INTEGER REFERENCES monitoring(id) ON DELETE CASCADE,
  alert_type VARCHAR(50),
  message TEXT,
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
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
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
  ai_chat_count INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  scan_count INTEGER DEFAULT 0,
  UNIQUE(user_id, hour_start)
);

CREATE TABLE community_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(255),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q) { return new Promise(r => rl.question(q, r)); }

async function main() {
  console.log("NESTI DATABASE RESET\n");
  const a = await ask("Type 'yes' to reset: ");
  if (a.trim().toLowerCase() !== "yes") { console.log("Cancelled."); rl.close(); return; }

  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    for (const t of TABLES) { await c.query(`DROP TABLE IF EXISTS ${t} CASCADE`); console.log(`  Dropped: ${t}`); }
    await c.query(CREATE_SQL);
    console.log("\nDone!");
  } catch (e) { console.error("Error:", e.message); }
  finally { await c.end(); rl.close(); }
}

main();
