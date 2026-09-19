import { NextRequest, NextResponse } from "next/server";
import pool, { getUserByFirebaseUid } from "@/lib/db";

const PYTHON_URL = process.env.NESTI_PYTHON_URL || "http://127.0.0.1:8090";

function getFirebaseUid(req: NextRequest): string | null {
  return req.headers.get("x-firebase-uid");
}

export async function POST(req: NextRequest) {
  try {
    const uid = getFirebaseUid(req);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByFirebaseUid(uid);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { session_id, content } = await req.json();
    if (!session_id || !content) {
      return NextResponse.json({ error: "Missing session_id or content" }, { status: 400 });
    }

    const ownership = await pool.query(
      "SELECT id FROM sessions WHERE id = $1 AND user_id = $2",
      [session_id, user.id]
    );
    if (ownership.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await pool.query(
      "INSERT INTO messages (session_id, user_id, role, content) VALUES ($1, $2, 'user', $3)",
      [session_id, user.id, content]
    );

    const historyResult = await pool.query(
      "SELECT role, content FROM messages WHERE session_id = $1 AND user_id = $2 ORDER BY created_at ASC",
      [session_id, user.id]
    );
    const history = historyResult.rows;

    const pyRes = await fetch(`${PYTHON_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, context: { user_id: user.id, session_id }, user_name: user.name || user.email }),
    });

    let reply: string;
    if (pyRes.ok) {
      const pyData = await pyRes.json();
      reply = pyData.reply || "No response from Nesti.";
    } else {
      reply = "Nesti AI service is temporarily unavailable. Please try again.";
    }

    await pool.query(
      "INSERT INTO messages (session_id, user_id, role, content) VALUES ($1, $2, 'assistant', $3)",
      [session_id, user.id, reply]
    );

    await pool.query(
      "UPDATE sessions SET updated_at = NOW() WHERE id = $1",
      [session_id]
    );

    return NextResponse.json({ reply });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
