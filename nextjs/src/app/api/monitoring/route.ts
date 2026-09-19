import { NextRequest, NextResponse } from "next/server";
import pool, { getUserByFirebaseUid } from "@/lib/db";

function getFirebaseUid(req: NextRequest): string | null {
  return req.headers.get("x-firebase-uid");
}

function calcNextRun(scheduleType: string, hour: number, minute: number, day: number, month: number, weekday: number): string {
  const now = new Date();
  const next = new Date(now);

  if (scheduleType === "hourly") {
    next.setHours(next.getHours() + 1);
    next.setMinutes(minute, 0, 0);
  } else if (scheduleType === "every_6h") {
    next.setHours(next.getHours() + (6 - (next.getHours() % 6)));
    next.setMinutes(minute, 0, 0);
  } else if (scheduleType === "every_12h") {
    next.setHours(next.getHours() + (12 - (next.getHours() % 12)));
    next.setMinutes(minute, 0, 0);
  } else if (scheduleType === "daily") {
    next.setDate(next.getDate() + 1);
    next.setHours(hour, minute, 0, 0);
  } else if (scheduleType === "weekly") {
    const daysUntil = ((weekday - next.getDay()) + 7) % 7 || 7;
    next.setDate(next.getDate() + daysUntil);
    next.setHours(hour, minute, 0, 0);
  } else if (scheduleType === "monthly") {
    next.setMonth(next.getMonth() + 1);
    next.setDate(day || 1);
    next.setHours(hour, minute, 0, 0);
  } else if (scheduleType === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
    next.setMonth(month || 0);
    next.setDate(day || 1);
    next.setHours(hour, minute, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(hour, minute, 0, 0);
  }

  return next.toISOString();
}

function scheduleLabel(type: string, hour: number, minute: number, day: number, weekday: number): string {
  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  switch (type) {
    case "hourly": return `Every hour at :${m}`;
    case "every_6h": return `Every 6 hours at :${m}`;
    case "every_12h": return `Every 12 hours at ${h}:${m}`;
    case "daily": return `Daily at ${h}:${m}`;
    case "weekly": return `${days[weekday] || "Mon"} at ${h}:${m}`;
    case "monthly": return `Day ${day || 1} of month at ${h}:${m}`;
    case "yearly": return `Yearly on day ${day || 1} at ${h}:${m}`;
    default: return `Daily at ${h}:${m}`;
  }
}

export async function GET(req: NextRequest) {
  try {
    const uid = getFirebaseUid(req);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByFirebaseUid(uid);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const result = await pool.query(
      "SELECT * FROM monitoring WHERE user_id = $1 ORDER BY created_at DESC",
      [user.id]
    );
    return NextResponse.json({ monitors: result.rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = getFirebaseUid(req);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByFirebaseUid(uid);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const {
      target_url, check_type,
      schedule_type, schedule_hour, schedule_minute,
      schedule_day, schedule_month, schedule_weekday
    } = await req.json();

    if (!target_url) return NextResponse.json({ error: "Missing target_url" }, { status: 400 });

    const sType = schedule_type || "daily";
    const sHour = schedule_hour ?? 0;
    const sMinute = schedule_minute ?? 0;
    const sDay = schedule_day ?? 0;
    const sMonth = schedule_month ?? 0;
    const sWeekday = schedule_weekday ?? 1;

    const nextRun = calcNextRun(sType, sHour, sMinute, sDay, sMonth, sWeekday);
    const label = scheduleLabel(sType, sHour, sMinute, sDay, sWeekday);

    const result = await pool.query(
      `INSERT INTO monitoring (user_id, target_url, check_type, schedule, schedule_type,
        schedule_hour, schedule_minute, schedule_day, schedule_month, schedule_weekday,
        next_run)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [user.id, target_url, check_type || "full", label, sType,
        sHour, sMinute, sDay, sMonth, sWeekday, nextRun]
    );

    return NextResponse.json({ monitor: result.rows[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const uid = getFirebaseUid(req);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByFirebaseUid(uid);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id, status } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const ownership = await pool.query(
      "SELECT id FROM monitoring WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );
    if (ownership.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await pool.query(
      "UPDATE monitoring SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3",
      [status || "paused", id, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const uid = getFirebaseUid(req);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByFirebaseUid(uid);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await pool.query(
      "DELETE FROM monitoring WHERE id = $1 AND user_id = $2",
      [id, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
