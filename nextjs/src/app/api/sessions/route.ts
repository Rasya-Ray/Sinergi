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
      "SELECT id, title, created_at, updated_at FROM sessions WHERE user_id = $1 ORDER BY updated_at DESC",
      [user.id]
    );
    return NextResponse.json({ sessions: result.rows });
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

    const { title } = await req.json();
    const result = await pool.query(
      "INSERT INTO sessions (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at, updated_at",
      [user.id, title || "New Chat"]
    );
    return NextResponse.json({ session: result.rows[0] });
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

    const { session_id } = await req.json();
    if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    const ownership = await pool.query(
      "SELECT id FROM sessions WHERE id = $1 AND user_id = $2",
      [session_id, user.id]
    );
    if (ownership.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await pool.query("DELETE FROM messages WHERE session_id = $1", [session_id]);
    await pool.query("DELETE FROM sessions WHERE id = $1", [session_id]);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
