import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { firebaseUid, email, name } = await req.json();
    if (!firebaseUid || !email) {
      return NextResponse.json({ error: "Missing firebaseUid or email" }, { status: 400 });
    }
    const user = await getOrCreateUser(firebaseUid, email, name);
    return NextResponse.json({ user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
