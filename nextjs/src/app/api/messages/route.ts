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

    const sessionId = req.nextUrl.searchParams.get("session_id");
    if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    const ownership = await pool.query(
      "SELECT id FROM sessions WHERE id = $1 AND user_id = $2",
      [sessionId, user.id]
    );
    if (ownership.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await pool.query(
      "SELECT id, role, content, metadata, created_at FROM messages WHERE session_id = $1 AND user_id = $2 ORDER BY created_at ASC",
      [sessionId, user.id]
    );
    return NextResponse.json({ messages: result.rows });
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

    const { session_id, role, content, metadata } = await req.json();
    if (!session_id || !role || !content) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const ownership = await pool.query(
      "SELECT id FROM sessions WHERE id = $1 AND user_id = $2",
      [session_id, user.id]
    );
    if (ownership.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await pool.query(
      "INSERT INTO messages (session_id, user_id, role, content, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING id, role, content, metadata, created_at",
      [session_id, user.id, role, content, metadata || "{}"]
    );

    await pool.query(
      "UPDATE sessions SET updated_at = NOW() WHERE id = $1",
      [session_id]
    );

    return NextResponse.json({ message: result.rows[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
