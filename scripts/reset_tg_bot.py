#!/usr/bin/env python3
"""
NESTI Telegram Bot Reset
Resets all Telegram-linked data: unlink accounts, clear sessions, limits.
User accounts (email/password) are kept intact.
"""
import os
import sys
import psycopg2

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_Zd4mRIq9PCjk@ep-square-hill-b3y1avud-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
)


def main():
    print("=" * 40)
    print("  NESTI TELEGRAM BOT RESET")
    print("=" * 40)
    print()
    print("This will:")
    print("  - Unlink ALL Telegram accounts")
    print("  - Delete ALL tg_chat_sessions")
    print("  - Delete ALL tg_hourly_limits")
    print("  - User accounts (email) are KEPT")
    print()

    confirm = input("Type 'yes' to reset: ").strip().lower()
    if confirm != "yes":
        print("Cancelled.")
        return

    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Count before
    cur.execute("SELECT COUNT(*) FROM users WHERE telegram_id IS NOT NULL")
    linked = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM tg_chat_sessions")
    sessions = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM tg_hourly_limits")
    limits = cur.fetchone()[0]

    print(f"\nFound: {linked} linked accounts, {sessions} sessions, {limits} limit records")

    # Unlink all telegram accounts
    cur.execute("UPDATE users SET telegram_id = NULL, telegram_username = NULL WHERE telegram_id IS NOT NULL")
    print(f"  Unlinked {cur.rowcount} accounts")

    # Delete sessions
    cur.execute("DELETE FROM tg_chat_sessions")
    print(f"  Deleted {cur.rowcount} chat sessions")

    # Delete limits
    cur.execute("DELETE FROM tg_hourly_limits")
    print(f"  Deleted {cur.rowcount} hourly limit records")

    conn.commit()
    conn.close()

    print("\n" + "=" * 40)
    print("  TELEGRAM BOT RESET DONE!")
    print("=" * 40)


if __name__ == "__main__":
    main()
