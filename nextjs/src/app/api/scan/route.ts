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

    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    const hostname = url.startsWith("http") ? new URL(url).hostname : url.split("/")[0];

    const [scanRes, dnsRes, tlsRes] = await Promise.allSettled([
      fetch(`${PYTHON_URL}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }),
      fetch(`${PYTHON_URL}/dns-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: hostname }),
      }),
      fetch(`${PYTHON_URL}/tls-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: hostname }),
      }),
    ]);

    const scanData = scanRes.status === "fulfilled" && scanRes.value.ok ? await scanRes.value.json() : null;
    const dnsData = dnsRes.status === "fulfilled" && dnsRes.value.ok ? await dnsRes.value.json() : null;
    const tlsData = tlsRes.status === "fulfilled" && tlsRes.value.ok ? await tlsRes.value.json() : null;

    if (!scanData) {
      return NextResponse.json({ error: "Scan failed" }, { status: 500 });
    }

    const scanResult = await pool.query(
      `INSERT INTO scans (user_id, target_url, raw_data, findings, technologies, headers, security_headers, tls_info, cookies, redirects, dns_info, tls_check_info)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        user.id, url,
        JSON.stringify(scanData),
        JSON.stringify(scanData.findings || []),
        JSON.stringify(scanData.technologies || []),
        JSON.stringify(scanData.headers || {}),
        JSON.stringify(scanData.security_headers || {}),
        JSON.stringify(scanData.tls_info || {}),
        JSON.stringify(scanData.cookies || []),
        JSON.stringify(scanData.redirects || []),
        JSON.stringify(dnsData || {}),
        JSON.stringify(tlsData || {}),
      ]
    );

    return NextResponse.json({
      scan: scanResult.rows[0],
      dns: dnsData,
      tls: tlsData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
