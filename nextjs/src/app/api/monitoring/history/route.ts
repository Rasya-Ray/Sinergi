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

    const monitorId = req.nextUrl.searchParams.get("monitor_id");
    if (!monitorId) return NextResponse.json({ error: "Missing monitor_id" }, { status: 400 });

    const ownership = await pool.query("SELECT id FROM monitoring WHERE id = $1 AND user_id = $2", [monitorId, user.id]);
    if (ownership.rows.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await pool.query(
      "SELECT * FROM monitoring_history WHERE monitor_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50",
      [monitorId, user.id]
    );
    return NextResponse.json({ history: result.rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
