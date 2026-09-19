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

    const result = await pool.query(
      "SELECT telegram_id, telegram_username FROM users WHERE id = $1",
      [user.id]
    );

    const row = result.rows[0];
    if (row.telegram_id) {
      return NextResponse.json({
        linked: true,
        telegram_id: row.telegram_id,
        telegram_username: row.telegram_username,
      });
    }
    return NextResponse.json({ linked: false });
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

    await pool.query(
      "UPDATE users SET telegram_id = NULL, telegram_username = NULL WHERE id = $1",
      [user.id]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
