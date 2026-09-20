import { NextRequest, NextResponse } from "next/server";
import pool, { getUserByFirebaseUid } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, user_name, message, created_at
       FROM community_messages
       ORDER BY created_at DESC
       LIMIT 100`
    );
    return NextResponse.json({ messages: result.rows.reverse() });
  } catch (error: any) {
    return NextResponse.json({ messages: [], error: error.message });
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = req.headers.get("x-firebase-uid");
    if (!uid) {
      return NextResponse.json({ error: "Login dulu" }, { status: 401 });
    }

    const user = await getUserByFirebaseUid(uid);
    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "Pesan kosong" }, { status: 400 });
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: "Pesan terlalu panjang (maks 1000 karakter)" }, { status: 400 });
    }

    const userName = user.name || user.email?.split("@")[0] || "Anonymous";

    await pool.query(
      `INSERT INTO community_messages (user_id, user_name, message)
       VALUES ($1, $2, $3)`,
      [user.id, userName, message]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
