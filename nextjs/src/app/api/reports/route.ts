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

    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const ownership = await pool.query("SELECT * FROM reports WHERE id = $1 AND user_id = $2", [id, user.id]);
      if (ownership.rows.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ report: ownership.rows[0] });
    }

    const result = await pool.query(
      "SELECT id, target_url, report_type, title, version, created_at, updated_at FROM reports WHERE user_id = $1 ORDER BY created_at DESC",
      [user.id]
    );
    return NextResponse.json({ reports: result.rows });
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

    const { scan_id, target_url, report_type, title, content, parent_report_id } = await req.json();

    let version = 1;
    if (parent_report_id) {
      const prev = await pool.query("SELECT version FROM reports WHERE id = $1 AND user_id = $2", [parent_report_id, user.id]);
      if (prev.rows.length > 0) version = prev.rows[0].version + 1;
    }

    const result = await pool.query(
      `INSERT INTO reports (user_id, scan_id, target_url, report_type, title, content, version, parent_report_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [user.id, scan_id || null, target_url, report_type || "full", title || "Security Assessment Report", JSON.stringify(content || {}), version, parent_report_id || null]
    );

    return NextResponse.json({ report: result.rows[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
