import { NextRequest, NextResponse } from "next/server";
import pool, { getUserByFirebaseUid } from "@/lib/db";

function getFirebaseUid(req: NextRequest): string | null {
  return req.headers.get("x-firebase-uid");
}

export async function POST(req: NextRequest) {
  try {
    const uid = getFirebaseUid(req);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByFirebaseUid(uid);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { scan_id, scan, dns, tls } = await req.json();

    const findings = scan?.findings || [];
    const secHeaders = scan?.security_headers || {};
    const tlsInfo = scan?.tls_info || {};
    const missingHeaders = Object.entries(secHeaders)
      .filter(([, v]) => v === false)
      .map(([k]) => k);

    const severityCount = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
    const findingsAnalyzed = findings.map((f: any) => {
      const sev = (f.severity || "low").toLowerCase();
      if (sev in severityCount) severityCount[sev as keyof typeof severityCount]++;
      return {
        finding: f.detail || f.type,
        severity: f.severity || "LOW",
        what_happened: f.what_happened || f.detail,
        why_it_matters: f.why_it_matters || getWhyItMatters(f),
        potential_impact: f.potential_impact || getImpact(f),
        evidence: f.evidence || f.detail,
        recommendation: f.recommendation || getRecommendation(f),
      };
    });

    if (dns && dns.records) {
      const dnsFindings = analyzeDns(dns);
      findingsAnalyzed.push(...dnsFindings);
      dnsFindings.forEach((f: any) => {
        const sev = (f.severity || "informational").toLowerCase();
        if (sev in severityCount) severityCount[sev as keyof typeof severityCount]++;
      });
    }

    if (tls) {
      const tlsFindings = analyzeTls(tls);
      findingsAnalyzed.push(...tlsFindings);
      tlsFindings.forEach((f: any) => {
        const sev = (f.severity || "informational").toLowerCase();
        if (sev in severityCount) severityCount[sev as keyof typeof severityCount]++;
      });
    }

    const correlations = buildCorrelations(scan, dns, tls);

    const webUpdates = generateWebUpdates(findingsAnalyzed, missingHeaders, secHeaders, tls, dns);

    const maxSeverity = severityCount.critical > 0 ? "Critical"
      : severityCount.high > 0 ? "High"
      : severityCount.medium > 0 ? "Medium"
      : severityCount.low > 0 ? "Low" : "Informational";

    const riskExplanation = {
      level: maxSeverity,
      meaning: getRiskMeaning(maxSeverity, severityCount),
      reasons: getRiskReasons(findingsAnalyzed, missingHeaders, tls),
      priority: getPriority(findingsAnalyzed),
    };

    const summary = `Security scan of ${scan?.target_url || "unknown"} found ${findingsAnalyzed.length} findings (${severityCount.high} high, ${severityCount.medium} medium, ${severityCount.low} low, ${severityCount.informational} informational).`;

    const result = await pool.query(
      `INSERT INTO analyses (scan_id, user_id, target_url, summary, findings_analyzed, correlations, severity_summary, risk_explanation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        scan_id || null, user.id, scan?.target_url || "",
        summary, JSON.stringify(findingsAnalyzed), JSON.stringify(correlations),
        JSON.stringify(severityCount), JSON.stringify(riskExplanation),
      ]
    );

    return NextResponse.json({
      analysis: result.rows[0],
      summary,
      findings_analyzed: findingsAnalyzed,
      correlations,
      web_updates: webUpdates,
      severity_summary: severityCount,
      risk_explanation: riskExplanation,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getWhyItMatters(f: any): string {
  const d = (f.detail || "").toLowerCase();
  if (d.includes("server") && d.includes("exposed")) return "Server version information helps attackers fingerprint the software and find known vulnerabilities.";
  if (d.includes("missing") && d.includes("header")) return "Security headers help protect against common web attacks.";
  if (d.includes("cookie") && d.includes("secure")) return "Cookies without Secure flag can be transmitted over unencrypted connections.";
  if (d.includes("cookie") && d.includes("httponly")) return "Cookies without HttpOnly can be accessed by JavaScript, increasing XSS impact.";
  return "This finding may affect the overall security posture of the application.";
}

function getImpact(f: any): string {
  const d = (f.detail || "").toLowerCase();
  if (d.includes("high")) return "Significant security risk that should be addressed promptly.";
  if (d.includes("medium")) return "Moderate security concern that increases exposure under certain conditions.";
  if (d.includes("low")) return "Minor security observation. Low immediate risk but worth addressing.";
  return "Informational finding. No immediate security impact.";
}

function getRecommendation(f: any): string {
  const d = (f.detail || "").toLowerCase();
  if (d.includes("server") && d.includes("exposed")) return "Consider removing or minimizing server version information in HTTP headers.";
  if (d.includes("missing") && d.includes("content-security-policy")) return "Implement a Content-Security-Policy header appropriate for your application.";
  if (d.includes("missing") && d.includes("strict-transport-security")) return "Add HSTS header to enforce HTTPS connections.";
  if (d.includes("missing") && d.includes("x-content-type-options")) return "Add X-Content-Type-Options: nosniff header.";
  if (d.includes("missing") && d.includes("x-frame-options")) return "Add X-Frame-Options header to prevent clickjacking.";
  return "Review the finding and implement appropriate security controls.";
}

function analyzeDns(dns: any): any[] {
  const findings: any[] = [];
  const records = dns.records || {};
  if (!records.A || records.A.length === 0) {
    findings.push({ finding: "No A record found", severity: "Informational", what_happened: "Domain has no A record.", why_it_matters: "A records map domain to IPv4.", potential_impact: "Domain may not resolve.", evidence: "DNS lookup returned no A record.", recommendation: "Verify DNS configuration." });
  }
  if (records.TXT) {
    const spf = records.TXT.find((t: string) => t.includes("v=spf1"));
    const dmarc = records.TXT.find((t: string) => t.includes("v=DMARC1"));
    if (!spf) findings.push({ finding: "No SPF record found", severity: "Low", what_happened: "No SPF record detected.", why_it_matters: "SPF helps prevent email spoofing.", potential_impact: "Domain may be used for email spoofing.", evidence: "No TXT record with v=spf1.", recommendation: "Configure SPF record." });
    if (!dmarc) findings.push({ finding: "No DMARC record found", severity: "Low", what_happened: "No DMARC record detected.", why_it_matters: "DMARC provides email authentication policy.", potential_impact: "Email spoofing protection is reduced.", evidence: "No TXT record with v=DMARC1.", recommendation: "Configure DMARC record." });
  }
  if (records.MX && records.MX.length > 0) {
    findings.push({ finding: "MX records detected", severity: "Informational", what_happened: `Found ${records.MX.length} MX record(s).`, why_it_matters: "MX records indicate email servers.", potential_impact: "N/A - informational.", evidence: `MX: ${JSON.stringify(records.MX)}`, recommendation: "Verify mail server configuration." });
  }
  return findings;
}

function analyzeTls(tls: any): any[] {
  const findings: any[] = [];
  if (tls.valid === false) {
    findings.push({ finding: "TLS certificate invalid", severity: "High", what_happened: "Certificate validation failed.", why_it_matters: "Invalid certificates expose users to MITM attacks.", potential_impact: "Users may encounter security warnings or be exposed to attacks.", evidence: tls.error || "Certificate validation failed.", recommendation: "Renew or fix the TLS certificate." });
  }
  if (tls.expiry) {
    const daysLeft = Math.floor((new Date(tls.expiry).getTime() - Date.now()) / 86400000);
    if (daysLeft < 30) {
      findings.push({ finding: `TLS certificate expires in ${daysLeft} days`, severity: daysLeft < 7 ? "High" : "Medium", what_happened: `Certificate expires on ${tls.expiry}.`, why_it_matters: "Expired certificates break HTTPS and erode trust.", potential_impact: "Users will see security warnings.", evidence: `Expiry: ${tls.expiry}`, recommendation: "Renew the certificate before expiry." });
    }
  }
  if (tls.version && (tls.version.includes("1.0") || tls.version.includes("1.1"))) {
    findings.push({ finding: `Outdated TLS version: ${tls.version}`, severity: "Medium", what_happened: `Server supports ${tls.version}.`, why_it_matters: "TLS 1.0/1.1 have known weaknesses.", potential_impact: "Connections may be vulnerable to downgrade attacks.", evidence: `TLS version: ${tls.version}`, recommendation: "Disable TLS 1.0/1.1, enforce TLS 1.2+." });
  }
  return findings;
}

function buildCorrelations(scan: any, dns: any, tls: any): any[] {
  const correlations: any[] = [];
  if (dns?.records?.A && scan?.headers?.server) {
    correlations.push({ type: "infrastructure", description: `Server ${scan.headers.server} resolves to IP ${dns.records.A[0]}`, severity: "Informational" });
  }
  if (tls && scan?.tls_info) {
    correlations.push({ type: "tls_match", description: "TLS certificate and HTTP headers analyzed for consistency.", severity: "Informational" });
  }
  return correlations;
}

function getRiskMeaning(level: string, count: any): string {
  if (level === "Critical") return "Critical security issues found that require immediate attention.";
  if (level === "High") return "Multiple high-severity findings detected. Prompt remediation recommended.";
  if (level === "Medium") return "Several medium-severity conditions found that may increase risk.";
  if (level === "Low") return "Low-severity findings detected. Review recommended.";
  return "No significant security issues detected. Findings are informational.";
}

function getRiskReasons(findings: any[], missingHeaders: string[], tls: any): string[] {
  const reasons: string[] = [];
  if (missingHeaders.length > 0) reasons.push(`${missingHeaders.length} security headers missing`);
  if (tls?.valid === false) reasons.push("TLS certificate invalid");
  const highCount = findings.filter((f: any) => f.severity === "HIGH").length;
  if (highCount > 0) reasons.push(`${highCount} high-severity findings`);
  if (reasons.length === 0) reasons.push("No major issues detected");
  return reasons;
}

function getPriority(findings: any[]): string[] {
  return findings
    .filter((f: any) => f.severity === "HIGH" || f.severity === "CRITICAL")
    .map((f: any) => f.finding)
    .slice(0, 5);
}

function generateWebUpdates(findings: any[], missingHeaders: string[], secHeaders: any, tls: any, dns: any): any[] {
  const updates: any[] = [];
  const findingTypes = new Set(findings.map((f: any) => {
    const detail = (f.finding || f.detail || "").toLowerCase();
    return detail;
  }));

  const hasType = (type: string) => findings.some((f: any) => (f.finding || f.detail || "").toLowerCase().includes(type));
  const hasMissing = (h: string) => missingHeaders.includes(h);

  if (hasMissing("content-security-policy")) {
    updates.push({
      category: "Security Headers",
      title: "Add Content-Security-Policy (CSP)",
      priority: "HIGH",
      description: "CSP prevents XSS by controlling which resources the browser can load.",
      how_to_fix: "Add a Content-Security-Policy header. Start with default-src 'self' and adjust.",
      code_example: "Content-Security-Policy: default-src 'self'; script-src 'self';",
    });
  }

  if (hasMissing("strict-transport-security")) {
    updates.push({
      category: "Security Headers",
      title: "Add Strict-Transport-Security (HSTS)",
      priority: "HIGH",
      description: "HSTS forces browsers to only connect via HTTPS.",
      how_to_fix: "Add HSTS header with a long max-age.",
      code_example: "Strict-Transport-Security: max-age=31536000; includeSubDomains",
    });
  }

  if (hasMissing("x-content-type-options")) {
    updates.push({
      category: "Security Headers",
      title: "Add X-Content-Type-Options",
      priority: "MEDIUM",
      description: "Prevents MIME-sniffing away from the declared content type.",
      how_to_fix: "Add this header to all responses.",
      code_example: "X-Content-Type-Options: nosniff",
    });
  }

  if (hasMissing("x-frame-options")) {
    updates.push({
      category: "Security Headers",
      title: "Add X-Frame-Options",
      priority: "MEDIUM",
      description: "Protects against clickjacking by preventing iframe embedding.",
      how_to_fix: "Add X-Frame-Options header.",
      code_example: "X-Frame-Options: DENY",
    });
  }

  if (hasMissing("referrer-policy")) {
    updates.push({
      category: "Security Headers",
      title: "Add Referrer-Policy",
      priority: "LOW",
      description: "Controls referrer information sent with requests.",
      how_to_fix: "Add Referrer-Policy header.",
      code_example: "Referrer-Policy: strict-origin-when-cross-origin",
    });
  }

  if (hasMissing("permissions-policy")) {
    updates.push({
      category: "Security Headers",
      title: "Add Permissions-Policy",
      priority: "LOW",
      description: "Controls which browser features the website can use.",
      how_to_fix: "Add Permissions-Policy header.",
      code_example: "Permissions-Policy: camera=(), microphone=()",
    });
  }

  if (hasType("sql injection") || hasType("sqli")) {
    updates.push({
      category: "Database Security",
      title: "Use Parameterized Queries",
      priority: "CRITICAL",
      description: "SQL injection vulnerability detected. Never concatenate user input into SQL.",
      how_to_fix: "Use parameterized queries or prepared statements for all database interactions.",
      code_example: "// BAD: `SELECT * FROM users WHERE id = '${userInput}'`\n// GOOD: `SELECT * FROM users WHERE id = $1`",
    });
  }

  if (hasType("xss") || hasType("cross-site scripting")) {
    updates.push({
      category: "Input Validation",
      title: "Implement Input Sanitization",
      priority: "CRITICAL",
      description: "XSS vulnerability detected. User input must be sanitized before rendering.",
      how_to_fix: "Sanitize and encode all user input on both client and server side.",
      code_example: "// Use DOMPurify for HTML, encode for output contexts",
    });
  }

  if (hasType("directory traversal")) {
    updates.push({
      category: "File Security",
      title: "Sanitize File Paths",
      priority: "CRITICAL",
      description: "Directory traversal detected. Attacker can read arbitrary server files.",
      how_to_fix: "Validate file paths against a whitelist. Never use user input directly in file operations.",
      code_example: "// Validate: os.path.abspath(path).startswith(VALID_DIR)",
    });
  }

  if (hasType("directory listing")) {
    updates.push({
      category: "Server Configuration",
      title: "Disable Directory Listing",
      priority: "MEDIUM",
      description: "Directory listing is enabled on the server.",
      how_to_fix: "Disable directory listing in web server configuration.",
      code_example: "// Nginx: autoindex off;\n// Apache: Options -Indexes",
    });
  }

  if (hasType("admin panel")) {
    updates.push({
      category: "Access Control",
      title: "Restrict Admin Panel Access",
      priority: "MEDIUM",
      description: "Admin panels are publicly accessible.",
      how_to_fix: "Restrict to internal networks or VPN. Add rate limiting and IP whitelisting.",
      code_example: "# Nginx: allow 10.0.0.0/8; deny all;",
    });
  }

  if (hasType("open redirect")) {
    updates.push({
      category: "URL Security",
      title: "Fix Open Redirect",
      priority: "HIGH",
      description: "User-controlled redirect can send victims to malicious sites.",
      how_to_fix: "Validate redirect URLs against a whitelist.",
      code_example: "// Only allow internal paths: if url.startswith('/'): redirect(url)",
    });
  }

  if (hasType("crlf") || hasType("header injection")) {
    updates.push({
      category: "Input Validation",
      title: "Sanitize CRLF Characters",
      priority: "HIGH",
      description: "CRLF injection allows injecting arbitrary HTTP headers.",
      how_to_fix: "Remove \\r and \\n from all user input.",
      code_example: "input = input.replace('\\r', '').replace('\\n', '')",
    });
  }

  if (hasType("cors") && hasType("arbitrary")) {
    updates.push({
      category: "CORS",
      title: "Fix CORS Configuration",
      priority: "CRITICAL",
      description: "CORS reflects arbitrary origins. Any site can make authenticated requests.",
      how_to_fix: "Whitelist specific trusted origins. Never reflect arbitrary origins.",
      code_example: "// Check origin against allowed list before setting ACAO header",
    });
  }

  if (hasType("cookie") && hasType("missing")) {
    updates.push({
      category: "Session Security",
      title: "Secure Session Cookies",
      priority: "MEDIUM",
      description: "Session cookies are missing security flags.",
      how_to_fix: "Set HttpOnly, Secure, and SameSite flags on all session cookies.",
      code_example: "Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Strict",
    });
  }

  if (hasType("csrf")) {
    updates.push({
      category: "Form Security",
      title: "Add CSRF Tokens",
      priority: "HIGH",
      description: "POST form missing CSRF protection.",
      how_to_fix: "Add anti-CSRF tokens to all POST forms.",
      code_example: '<input type="hidden" name="_token" value="{{csrf_token}}">',
    });
  }

  if (hasType("login form") && hasType("get method")) {
    updates.push({
      category: "Authentication",
      title: "Use POST for Login Forms",
      priority: "HIGH",
      description: "Login form sends credentials via GET (visible in URL/logs).",
      how_to_fix: "Change form method to POST.",
      code_example: '<form method="POST" action="/login">',
    });
  }

  if (hasType("no captcha")) {
    updates.push({
      category: "Authentication",
      title: "Add CAPTCHA to Login",
      priority: "MEDIUM",
      description: "Login form lacks CAPTCHA protection against brute-force.",
      how_to_fix: "Add reCAPTCHA or hCAPTCHA and server-side rate limiting.",
      code_example: "// Add reCAPTCHA widget and verify server-side",
    });
  }

  if (hasType("open redirect")) {
    updates.push({
      category: "URL Security",
      title: "Fix Open Redirect",
      priority: "HIGH",
      description: "Open redirect allows attacker to redirect users to malicious sites.",
      how_to_fix: "Whitelist allowed redirect destinations.",
      code_example: "// Only redirect to whitelisted paths",
    });
  }

  if (tls && tls.expired) {
    updates.push({
      category: "TLS/SSL",
      title: "Renew TLS Certificate",
      priority: "CRITICAL",
      description: "TLS certificate is expired.",
      how_to_fix: "Renew the certificate. Use Let's Encrypt for free certs.",
      code_example: "certbot renew",
    });
  }

  if (tls?.version && (tls.version.includes("1.0") || tls.version.includes("1.1"))) {
    updates.push({
      category: "TLS/SSL",
      title: "Disable TLS 1.0/1.1",
      priority: "MEDIUM",
      description: "Server supports outdated TLS versions.",
      how_to_fix: "Configure server to only accept TLS 1.2+.",
      code_example: "# Nginx: ssl_protocols TLSv1.2 TLSv1.3;",
    });
  }

  if (dns?.records) {
    const spf = dns.records.TXT?.some((t: string) => t.includes("v=spf1"));
    const dmarc = dns.records.TXT?.some((t: string) => t.includes("v=DMARC1"));
    if (!spf) {
      updates.push({
        category: "Email Security",
        title: "Add SPF Record",
        priority: "MEDIUM",
        description: "No SPF record found. Domain can be spoofed for email.",
        how_to_fix: "Add SPF TXT record to DNS.",
        code_example: "v=spf1 include:_spf.google.com ~all",
      });
    }
    if (!dmarc) {
      updates.push({
        category: "Email Security",
        title: "Add DMARC Record",
        priority: "MEDIUM",
        description: "No DMARC record found.",
        how_to_fix: "Add DMARC TXT record to DNS.",
        code_example: "v=DMARC1; p=quarantine; rua=mailto:admin@domain.com",
      });
    }
  }

  return updates;
}
