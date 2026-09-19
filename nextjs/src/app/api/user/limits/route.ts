import { NextRequest, NextResponse } from "next/server";
import pool, { getUserByFirebaseUid } from "@/lib/db";

function getFirebaseUid(req: NextRequest): string | null {
  return req.headers.get("x-firebase-uid");
}

export async function GET(req: NextRequest) {
  try {
    const uid = getFirebaseUid(req);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByFirebaseUid(uid);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const now = new Date();
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);

    const today = now.toISOString().split("T")[0];

    const [pptResult, tgResult] = await Promise.all([
      pool.query(
        "SELECT COUNT(*) as count FROM ppt_rate_limits WHERE user_id = $1 AND export_date = $2",
        [user.id, today]
      ),
      pool.query(
        "SELECT ai_chat_count, report_count, scan_count FROM tg_hourly_limits WHERE user_id = $1 AND hour_start = $2",
        [user.id, hourStart]
      ),
    ]);

    const pptUsed = parseInt(pptResult.rows[0]?.count || "0");
    const tgRow = tgResult.rows[0];

    return NextResponse.json({
      ppt: { used: pptUsed, limit: 5, remaining: Math.max(0, 5 - pptUsed) },
      tg_ai: {
        used: parseInt(tgRow?.ai_chat_count || "0"),
        limit: 10,
        remaining: Math.max(0, 10 - parseInt(tgRow?.ai_chat_count || "0")),
      },
      tg_laporan: {
        used: parseInt(tgRow?.report_count || "0"),
        limit: 10,
        remaining: Math.max(0, 10 - parseInt(tgRow?.report_count || "0")),
      },
      tg_scan: {
        used: parseInt(tgRow?.scan_count || "0"),
        limit: 10,
        remaining: Math.max(0, 10 - parseInt(tgRow?.scan_count || "0")),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
