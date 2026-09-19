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
