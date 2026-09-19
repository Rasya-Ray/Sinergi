import os
import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta
import psycopg2

logger = logging.getLogger("tg_scheduler")

WIB = timezone(timedelta(hours=7))

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_Zd4mRIq9PCjk@ep-square-hill-b3y1avud-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
)
PYTHON_URL = os.getenv("NESTI_PYTHON_URL", "http://127.0.0.1:8090")


def get_db():
    return psycopg2.connect(DB_URL)


def get_users_with_telegram():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, telegram_id, name FROM users WHERE telegram_id IS NOT NULL")
    rows = cur.fetchall()
    conn.close()
    return [{"user_id": r[0], "telegram_id": r[1], "name": r[2]} for r in rows]


def get_user_monitors(user_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """SELECT id, target_url, schedule, schedule_type, schedule_interval_minutes,
           last_run, next_run
           FROM monitoring WHERE user_id = %s AND status = 'active'""",
        (user_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return [
        {
            "id": r[0], "url": r[1], "schedule": r[2],
            "schedule_type": r[3], "interval_minutes": r[4],
            "last_run": r[5], "next_run": r[6],
        }
        for r in rows
    ]


def update_last_run(monitor_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE monitoring SET last_run = NOW() WHERE id = %s", (monitor_id,))
    conn.commit()
    conn.close()


def run_scan(url: str) -> dict:
    import httpx
    resp = httpx.post(f"{PYTHON_URL}/scan", json={"url": url}, timeout=60)
    return resp.json()


def format_report_text(url: str, result: dict) -> str:
    findings = result.get("findings", [])
    headers = result.get("security_headers", {})
    missing = [h for h, v in headers.items() if not v] if isinstance(headers, dict) else []

    now = datetime.now(WIB)
    text = f"NESTI Monitoring Report\n"
    text += f"URL: {url}\n"
    text += f"Waktu: {now.strftime('%d %b %Y %H:%M WIB')}\n"
    text += f"Findings: {len(findings)}\n\n"

    if findings:
        for f in findings[:5]:
            sev = f.get("severity", "?").upper()
            title = f.get("title") or f.get("detail") or f.get("finding", "?")
            text += f"  [{sev}] {title[:80]}\n"
    else:
        text += "  Tidak ada masalah terdeteksi.\n"

    if missing:
        text += f"\nMissing Headers: {', '.join(missing[:5])}"

    return text


def should_run_monitor(mon) -> bool:
    now = datetime.now(timezone.utc)
    next_run = mon.get("next_run")
    last_run = mon.get("last_run")
    interval = mon.get("interval_minutes")

    if next_run:
        if next_run.tzinfo is None:
            next_run = next_run.replace(tzinfo=timezone.utc)
        if now >= next_run:
            return True

    if interval and interval > 0:
        if last_run:
            if last_run.tzinfo is None:
                last_run = last_run.replace(tzinfo=timezone.utc)
            if (now - last_run).total_seconds() >= interval * 60:
                return True
        else:
            return True

    return False


async def scheduler_loop(bot_app):
    logger.info("Scheduler started (WIB timezone)")
    while True:
        try:
            users = get_users_with_telegram()
            for user in users:
                monitors = get_user_monitors(user["user_id"])
                for mon in monitors:
                    if should_run_monitor(mon):
                        try:
                            result = run_scan(mon["url"])
                            text = format_report_text(mon["url"], result)
                            await bot_app.bot.send_message(
                                chat_id=user["telegram_id"],
                                text=text[:4000],
                            )
                            update_last_run(mon["id"])
                            logger.info(f"Sent report for {mon['url']} to {user['telegram_id']}")
                        except Exception as e:
                            logger.error(f"Failed to send report: {e}")
        except Exception as e:
            logger.error(f"Scheduler error: {e}")

        await asyncio.sleep(60)
