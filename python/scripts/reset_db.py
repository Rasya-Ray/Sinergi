#!/usr/bin/env python3
"""
NESTI Database Reset Script
Drops all tables and recreates them fresh.
"""

import os
import sys
import psycopg2

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_Zd4mRIq9PCjk@ep-square-hill-b3y1avud-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
)

TABLES = [
    "tg_hourly_limits",
    "tg_chat_sessions",
    "chat_messages",
    "chat_sessions",
    "reports",
    "scans",
    "monitoring",
    "alerts",
    "users",
]

CREATE_SQL = """
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    telegram_id BIGINT UNIQUE,
    telegram_username VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE monitoring (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    target_url TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    schedule VARCHAR(100),
    schedule_type VARCHAR(50),
    schedule_interval_minutes INTEGER,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE scans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    target_url TEXT NOT NULL,
    findings JSONB DEFAULT '[]',
    security_headers JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    report_type VARCHAR(50),
    target_url TEXT,
    content JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    monitoring_id INTEGER REFERENCES monitoring(id) ON DELETE CASCADE,
    alert_type VARCHAR(50),
    message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'New Session',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tg_chat_sessions (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tg_hourly_limits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    hour_start TIMESTAMP NOT NULL,
    ai_chat_count INTEGER DEFAULT 0,
    report_count INTEGER DEFAULT 0,
    scan_count INTEGER DEFAULT 0,
    UNIQUE(user_id, hour_start)
);
"""


def main():
    confirm = input("Drop ALL tables and recreate? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("Cancelled.")
        return

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    for t in TABLES:
        cur.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
        print(f"  Dropped: {t}")

    cur.execute(CREATE_SQL)
    print("  All tables recreated.")

    conn.commit()
    conn.close()
    print("\nDatabase reset selesai!")


if __name__ == "__main__":
    main()
