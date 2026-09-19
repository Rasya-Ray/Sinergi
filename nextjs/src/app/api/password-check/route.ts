import { NextRequest, NextResponse } from "next/server";

const PYTHON_URL = process.env.NESTI_PYTHON_URL || "http://127.0.0.1:8090";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (!password) return NextResponse.json({ error: "Missing password" }, { status: 400 });

    const res = await fetch(`${PYTHON_URL}/password-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) return NextResponse.json({ error: "Service unavailable" }, { status: 500 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
