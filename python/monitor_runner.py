#!/usr/bin/env python3
"""NESTI Monitoring Cron — runs checks for all due monitors based on custom schedules."""
import os
import json
import httpx
import psycopg2
from datetime import datetime, timedelta

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://neondb_owner:npg_Zd4mRIq9PCjk@ep-square-hill-b3y1avud-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require")
PYTHON_URL = os.getenv("NESTI_PYTHON_URL", "http://127.0.0.1:8090")


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def calc_next_run(schedule_type, hour, minute, day, month, weekday):
    now = datetime.utcnow()
    nxt = now

    if schedule_type == "hourly":
        nxt = now + timedelta(hours=1)
        nxt = nxt.replace(minute=minute, second=0, microsecond=0)
    elif schedule_type == "every_6h":
        hours_ahead = 6 - (now.hour % 6)
        nxt = now + timedelta(hours=hours_ahead)
        nxt = nxt.replace(minute=minute, second=0, microsecond=0)
    elif schedule_type == "every_12h":
        hours_ahead = 12 - (now.hour % 12)
        nxt = now + timedelta(hours=hours_ahead)
        nxt = nxt.replace(minute=minute, second=0, microsecond=0)
    elif schedule_type == "daily":
        nxt = now + timedelta(days=1)
        nxt = nxt.replace(hour=hour, minute=minute, second=0, microsecond=0)
    elif schedule_type == "weekly":
        days_ahead = ((weekday - now.weekday()) + 7) % 7 or 7
        nxt = now + timedelta(days=days_ahead)
        nxt = nxt.replace(hour=hour, minute=minute, second=0, microsecond=0)
    elif schedule_type == "monthly":
        if now.month == 12:
            nxt = now.replace(year=now.year + 1, month=1, day=day or 1, hour=hour, minute=minute, second=0, microsecond=0)
        else:
            nxt = now.replace(month=now.month + 1, day=day or 1, hour=hour, minute=minute, second=0, microsecond=0)
    elif schedule_type == "yearly":
        nxt = now.replace(year=now.year + 1, month=month or 1, day=day or 1, hour=hour, minute=minute, second=0, microsecond=0)
    else:
        nxt = now + timedelta(days=1)
        nxt = nxt.replace(hour=hour, minute=minute, second=0, microsecond=0)

    return nxt


def run_check(monitor):
    target = monitor["target_url"]
    domain = target.replace("https://", "").replace("http://", "").split("/")[0]

    with httpx.Client(timeout=30) as client:
        scan_res = client.post(f"{PYTHON_URL}/scan", json={"url": f"https://{domain}"})
        dns_res = client.post(f"{PYTHON_URL}/dns-check", json={"domain": domain})
        tls_res = client.post(f"{PYTHON_URL}/tls-check", json={"domain": domain})

    scan_data = scan_res.json() if scan_res.status_code == 200 else {}
    dns_data = dns_res.json() if dns_res.status_code == 200 else {}
    tls_data = tls_res.json() if tls_res.status_code == 200 else {}

    return scan_data, dns_data, tls_data


def detect_changes(prev, curr):
    changes = []
    if not prev:
        return [{"type": "new_baseline", "description": "First scan — baseline established"}]

    prev_scan = prev.get("scan_data", {})
    curr_scan = curr.get("scan_data", {})

    if prev_scan.get("headers", {}).get("server") != curr_scan.get("headers", {}).get("server"):
        changes.append({"type": "server_change", "description": f"Server header changed: {prev_scan.get('headers',{}).get('server')} → {curr_scan.get('headers',{}).get('server')}"})

    prev_tls = prev.get("tls_data", {})
    curr_tls = curr.get("tls_data", {})
    if prev_tls.get("expiry") != curr_tls.get("expiry"):
        changes.append({"type": "cert_change", "description": f"Certificate expiry changed: {prev_tls.get('expiry')} → {curr_tls.get('expiry')}"})
    if prev_tls.get("version") != curr_tls.get("version"):
        changes.append({"type": "tls_change", "description": f"TLS version changed: {prev_tls.get('version')} → {curr_tls.get('version')}"})

    prev_dns = prev.get("dns_data", {}).get("records", {})
    curr_dns = curr.get("dns_data", {}).get("records", {})
    if prev_dns.get("A") != curr_dns.get("A"):
        changes.append({"type": "dns_change", "description": f"DNS A records changed: {prev_dns.get('A')} → {curr_dns.get('A')}"})

    prev_findings = set(f.get("detail", "") for f in prev_scan.get("findings", []))
    curr_findings = set(f.get("detail", "") for f in curr_scan.get("findings", []))
    new_findings = curr_findings - prev_findings
    resolved = prev_findings - curr_findings
    if new_findings:
        changes.append({"type": "new_findings", "description": f"New findings: {', '.join(list(new_findings)[:3])}"})
    if resolved:
        changes.append({"type": "resolved", "description": f"Resolved findings: {', '.join(list(resolved)[:3])}"})

    return changes


def main():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, user_id, target_url, check_type, previous_result,
               schedule_type, schedule_hour, schedule_minute,
               schedule_day, schedule_month, schedule_weekday, next_run
        FROM monitoring
        WHERE status = 'active' AND (next_run IS NULL OR next_run <= NOW())
    """)
    monitors = cur.fetchall()
    columns = ["id", "user_id", "target_url", "check_type", "previous_result",
               "schedule_type", "schedule_hour", "schedule_minute",
               "schedule_day", "schedule_month", "schedule_weekday", "next_run"]
    monitors = [dict(zip(columns, row)) for row in monitors]

    print(f"[{datetime.utcnow()}] Running {len(monitors)} due monitors")

    for monitor in monitors:
        try:
            scan_data, dns_data, tls_data = run_check(monitor)
            changes = detect_changes(monitor["previous_result"], {"scan_data": scan_data, "dns_data": dns_data, "tls_data": tls_data})

            cur.execute(
                """INSERT INTO monitoring_history (monitor_id, user_id, scan_data, dns_data, tls_data, changes_detected)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (monitor["id"], monitor["user_id"], json.dumps(scan_data), json.dumps(dns_data), json.dumps(tls_data), json.dumps(changes))
            )

            nxt = calc_next_run(
                monitor.get("schedule_type") or "daily",
                monitor.get("schedule_hour") or 0,
                monitor.get("schedule_minute") or 0,
                monitor.get("schedule_day") or 0,
                monitor.get("schedule_month") or 0,
                monitor.get("schedule_weekday") or 1,
            )

            cur.execute(
                """UPDATE monitoring SET last_run = NOW(), next_run = %s,
                   previous_result = %s WHERE id = %s""",
                (nxt.isoformat(), json.dumps({"scan_data": scan_data, "dns_data": dns_data, "tls_data": tls_data}), monitor["id"])
            )

            print(f"  ✓ {monitor['target_url']} — {len(changes)} change(s) — next: {nxt}")
        except Exception as e:
            print(f"  ✗ {monitor['target_url']} — {e}")

    conn.commit()
    cur.close()
    conn.close()
    print("Done!")


if __name__ == "__main__":
    main()
