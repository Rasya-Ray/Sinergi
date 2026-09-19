import os
import sys
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
import psycopg2

logger = logging.getLogger("tg_bot")

WIB = timezone(timedelta(hours=7))

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_Zd4mRIq9PCjk@ep-square-hill-b3y1avud-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
)
TG_TOKEN = os.getenv("TG_BOT_TOKEN", "8905303582:AAHZN6ncIUZiml87333mc5IkekuXo6BolrQ")
OPENCLAW_BIN = os.getenv("OPENCLAW_BIN", "openclaw")
OPENCLAW_AGENT = os.getenv("NESTI_AGENT_ID", "nesti")
AI_HOURLY_LIMIT = 10
REPORT_HOURLY_LIMIT = 10
SCAN_HOURLY_LIMIT = 10

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from services.scanner import SecurityScanner
_scanner = SecurityScanner()


def now_wib():
    return datetime.now(WIB)


def fmt_time(dt):
    if dt is None:
        return "?"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(WIB).strftime("%d %b %Y %H:%M WIB")


def get_db():
    return psycopg2.connect(DB_URL)


def get_user_by_tg_id(tg_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, name, email FROM users WHERE telegram_id = %s", (tg_id,))
    row = cur.fetchone()
    conn.close()
    return {"id": row[0], "name": row[1], "email": row[2]} if row else None


def link_telegram(tg_id: int, tg_username: str, email: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return False
    cur.execute(
        "UPDATE users SET telegram_id = %s, telegram_username = %s WHERE email = %s",
        (tg_id, tg_username, email),
    )
    conn.commit()
    cur.execute(
        """INSERT INTO tg_chat_sessions (telegram_id, user_id)
        VALUES (%s, %s) ON CONFLICT (telegram_id)
        DO UPDATE SET user_id = EXCLUDED.user_id, is_active = TRUE""",
        (tg_id, row[0]),
    )
    conn.commit()
    conn.close()
    return True


def check_hourly_limit(user_id, limit_type: str, limit: int):
    conn = get_db()
    cur = conn.cursor()
    now = now_wib()
    hour_start = now.replace(minute=0, second=0, microsecond=0)
    cur.execute(
        f"""INSERT INTO tg_hourly_limits (user_id, hour_start, {limit_type})
        VALUES (%s, %s, 1)
        ON CONFLICT (user_id, hour_start)
        DO UPDATE SET {limit_type} = tg_hourly_limits.{limit_type} + 1
        RETURNING {limit_type}""",
        (user_id, hour_start),
    )
    count = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return count <= limit, count


async def call_openclaw(message: str) -> str:
    try:
        proc = await asyncio.create_subprocess_exec(
            OPENCLAW_BIN, "agent", "--agent", OPENCLAW_AGENT, "-m", message,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        if proc.returncode == 0 and stdout:
            output = stdout.decode().strip()
            if "GatewayClientRequestError" in output:
                return ""
            return output
    except Exception:
        pass
    return ""


def get_user_monitors(user_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """SELECT id, target_url, status, schedule, schedule_type,
           schedule_interval_minutes, last_run, next_run
           FROM monitoring WHERE user_id = %s AND status = 'active'""",
        (user_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return [
        {
            "id": r[0], "url": r[1], "status": r[2], "schedule": r[3],
            "schedule_type": r[4], "interval_minutes": r[5],
            "last_run": r[6], "next_run": r[7],
        }
        for r in rows
    ]


def get_latest_scan_for_url(user_id, url: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, target_url, findings, created_at FROM scans WHERE user_id = %s AND target_url LIKE %s ORDER BY created_at DESC LIMIT 1",
        (user_id, f"%{url}%"),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {"id": str(row[0]), "url": row[1], "findings": row[2], "created_at": row[3]}


def get_reports_for_user(user_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, report_type, target_url, content, created_at FROM reports WHERE user_id = %s ORDER BY created_at DESC LIMIT 10",
        (user_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return [
        {"id": str(r[0]), "type": r[1], "url": r[2], "content": r[3], "created_at": r[4]}
        for r in rows
    ]


async def do_scan(url: str) -> dict:
    result = await _scanner.scan(url)
    if hasattr(result, "model_dump"):
        return result.model_dump()
    return result if isinstance(result, dict) else {}


def format_findings(findings: list) -> str:
    if not findings:
        return "  Tidak ada masalah terdeteksi."
    lines = []
    for f in findings[:5]:
        sev = f.get("severity", "?").upper()
        title = f.get("title") or f.get("detail") or f.get("finding", "?")
        lines.append(f"  [{sev}] {title[:80]}")
    return "\n".join(lines)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    existing = get_user_by_tg_id(user.id)
    if existing:
        await update.message.reply_text(
            f"Selamat datang kembali, {existing['name']}!\n\n"
            "Ketik /help untuk melihat semua command."
        )
    else:
        await update.message.reply_text(
            "Halo! Saya NESTI Bot, AI Web Security Analyst.\n\n"
            "Untuk menggunakan bot ini, link akun NESTI kamu:\n"
            "/link email@kamu.com\n\n"
            "Ketik /help untuk melihat semua command."
        )


async def cmd_link(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not context.args:
        await update.message.reply_text("Gunakan: /link email@kamu.com")
        return
    email = context.args[0]
    ok = link_telegram(user.id, user.username or "", email)
    if ok:
        await update.message.reply_text(
            f"Berhasil link! Akun NESTI ({email}) sudah terhubung.\n\n"
            "Ketik /help untuk melihat semua command."
        )
    else:
        await update.message.reply_text(
            "Email tidak ditemukan. Pastikan email sudah terdaftar di NESTI."
        )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "NESTI Bot Commands:\n\n"
        "/ai <pesan> - Chat AI Security Analyst\n"
        "/laporan - Laporan monitoring per URL\n"
        "/scan <url> - Scan website\n"
        "/status - Status monitoring\n"
        "/help - Tampilkan bantuan ini\n\n"
        f"Limit per jam: AI={AI_HOURLY_LIMIT}, Laporan={REPORT_HOURLY_LIMIT}, Scan={SCAN_HOURLY_LIMIT}"
    )


async def cmd_ai(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    existing = get_user_by_tg_id(user.id)
    if not existing:
        await update.message.reply_text("Akun belum terlink. Ketik /link email@kamu.com")
        return
    if not context.args:
        await update.message.reply_text("Gunakan: /ai <pesan>")
        return

    allowed, count = check_hourly_limit(existing["id"], "ai_chat_count", AI_HOURLY_LIMIT)
    if not allowed:
        await update.message.reply_text(
            f"Limit jam ini sudah habis ({AI_HOURLY_LIMIT}/{AI_HOURLY_LIMIT}).\nCoba lagi jam berikutnya."
        )
        return

    message = " ".join(context.args)
    await update.message.reply_text("Berpikir...")
    reply = await call_openclaw(message)
    if not reply:
        reply = "Maaf, AI sedang tidak tersedia. Coba lagi nanti."
    await update.message.reply_text(reply)


async def cmd_laporan(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    existing = get_user_by_tg_id(user.id)
    if not existing:
        await update.message.reply_text("Akun belum terlink. Ketik /link email@kamu.com")
        return

    allowed, count = check_hourly_limit(existing["id"], "report_count", REPORT_HOURLY_LIMIT)
    if not allowed:
        await update.message.reply_text(
            f"Limit jam ini sudah habis ({REPORT_HOURLY_LIMIT}/{REPORT_HOURLY_LIMIT}).\nCoba lagi jam berikutnya."
        )
        return

    monitors = get_user_monitors(existing["id"])
    if not monitors:
        await update.message.reply_text(
            "Belum ada monitoring aktif.\nTambah di https://nesti.pw/monitoring"
        )
        return

    reports = get_reports_for_user(existing["id"])
    report_urls = {}
    for r in reports:
        url = r.get("url")
        if url and url not in report_urls:
            report_urls[url] = r

    text = "LAPORAN MONITORING\n"
    text += f"Waktu: {now_wib().strftime('%d %b %Y %H:%M WIB')}\n\n"

    for mon in monitors:
        url = mon["url"]
        text += f"URL: {url}\n"
        text += f"Status: {mon['status']}\n"

        if mon.get("last_run"):
            text += f"Last Run: {fmt_time(mon['last_run'])}\n"
        if mon.get("next_run"):
            text += f"Next Run: {fmt_time(mon['next_run'])}\n"

        report = report_urls.get(url)
        if report:
            content = report["content"] or {}
            findings = content.get("findings", [])
            text += f"Laporan terakhir: {fmt_time(report['created_at'])}\n"
            text += f"Findings: {len(findings)}\n"
            text += format_findings(findings) + "\n\n"
        else:
            scan = get_latest_scan_for_url(existing["id"], url)
            if scan:
                findings = scan.get("findings") or []
                text += f"Scan terakhir: {fmt_time(scan['created_at'])}\n"
                text += f"Findings: {len(findings)}\n"
                text += format_findings(findings) + "\n\n"
            else:
                text += "Belum ada laporan.\n\n"

    await update.message.reply_text(text[:4000])


async def cmd_scan(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    existing = get_user_by_tg_id(user.id)
    if not existing:
        await update.message.reply_text("Akun belum terlink. Ketik /link email@kamu.com")
        return
    if not context.args:
        await update.message.reply_text("Gunakan: /scan example.com")
        return

    allowed, count = check_hourly_limit(existing["id"], "scan_count", SCAN_HOURLY_LIMIT)
    if not allowed:
        await update.message.reply_text(
            f"Limit jam ini sudah habis ({SCAN_HOURLY_LIMIT}/{SCAN_HOURLY_LIMIT}).\nCoba lagi jam berikutnya."
        )
        return

    url = context.args[0]
    if not url.startswith("http"):
        url = "https://" + url

    await update.message.reply_text(f"Scanning {url}...")

    try:
        result = await do_scan(url)
        findings = result.get("findings", [])
        headers_info = result.get("security_headers", {})
        missing = [h for h, v in headers_info.items() if not v] if isinstance(headers_info, dict) else []

        text = f"Scan selesai: {url}\n"
        text += f"Waktu: {now_wib().strftime('%d %b %Y %H:%M WIB')}\n"
        text += f"Findings: {len(findings)}\n\n"
        text += format_findings(findings)
        if missing:
            text += f"\n\nMissing Headers: {', '.join(missing[:5])}"

        await update.message.reply_text(text[:4000])
    except Exception as e:
        await update.message.reply_text(f"Scan gagal: {str(e)[:200]}")


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    existing = get_user_by_tg_id(user.id)
    if not existing:
        await update.message.reply_text("Akun belum terlink. Ketik /link email@kamu.com")
        return

    monitors = get_user_monitors(existing["id"])
    if not monitors:
        await update.message.reply_text(
            "Belum ada monitoring aktif.\nTambah di https://nesti.pw/monitoring"
        )
        return

    text = "MONITORING STATUS\n\n"
    for m in monitors:
        text += f"URL: {m['url']}\n"
        text += f"Status: {m['status']}\n"
        text += f"Schedule: {m.get('schedule') or m.get('schedule_type') or '-'}\n"
        if m.get("last_run"):
            text += f"Last Run: {fmt_time(m['last_run'])}\n"
        if m.get("next_run"):
            text += f"Next Run: {fmt_time(m['next_run'])}\n"
        text += "\n"

    await update.message.reply_text(text[:4000])


def create_bot_app() -> Application:
    app = Application.builder().token(TG_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("link", cmd_link))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("ai", cmd_ai))
    app.add_handler(CommandHandler("laporan", cmd_laporan))
    app.add_handler(CommandHandler("scan", cmd_scan))
    app.add_handler(CommandHandler("status", cmd_status))
    return app


async def post_init(app: Application):
    me = await app.bot.get_me()
    logger.info(f"NESTI Bot started: @{me.username}")
