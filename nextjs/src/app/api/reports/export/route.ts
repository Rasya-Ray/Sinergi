import { NextRequest, NextResponse } from "next/server";
import pool, { getUserByFirebaseUid } from "@/lib/db";

const PYTHON_URL = process.env.NESTI_PYTHON_URL || "http://127.0.0.1:8090";

function getFirebaseUid(req: NextRequest): string | null {
  return req.headers.get("x-firebase-uid");
}

interface StyleConfig {
  bgColor: string;
  titleColor: string;
  textColor: string;
  accentColor: string;
  fontFamily: string;
  titleSize: number;
  layout: string;
}

function getDefaultStyle(): StyleConfig {
  return { bgColor: "1a1a2e", titleColor: "ffe66d", textColor: "FFFFFF", accentColor: "4ecdc4", fontFamily: "Arial", titleSize: 48, layout: "centered" };
}

async function getStyleFromAI(prompt: string): Promise<Partial<StyleConfig> | null> {
  try {
    const res = await fetch(`${PYTHON_URL}/ai/style`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.source === "ai" && data.style) return data.style;
    return null;
  } catch {
    return null;
  }
}

function parseStyleFromPrompt(prompt: string): Partial<StyleConfig> {
  const p = prompt.toLowerCase();
  const style: Partial<StyleConfig> = {};

  if (p.includes("pink") || p.includes("rose") || p.includes("fuchsia")) {
    style.bgColor = "1a0a1a"; style.titleColor = "ff69b4"; style.textColor = "FFFFFF"; style.accentColor = "ff1493";
  } else if (p.includes("red") || p.includes("merah") || p.includes("crimson") || p.includes("blood")) {
    style.bgColor = "1a0a0a"; style.titleColor = "ff4444"; style.textColor = "FFFFFF"; style.accentColor = "cc0000";
  } else if (p.includes("blue") || p.includes("biru") || p.includes("navy") || p.includes("ocean")) {
    style.bgColor = "0a1628"; style.titleColor = "4da6ff"; style.textColor = "FFFFFF"; style.accentColor = "0066cc";
  } else if (p.includes("green") || p.includes("hijau") || p.includes("nature") || p.includes("forest")) {
    style.bgColor = "0a1a0a"; style.titleColor = "44ff44"; style.textColor = "FFFFFF"; style.accentColor = "228b22";
  } else if (p.includes("purple") || p.includes("ungu") || p.includes("violet")) {
    style.bgColor = "1a0a2e"; style.titleColor = "bb86fc"; style.textColor = "FFFFFF"; style.accentColor = "7c3aed";
  } else if (p.includes("orange") || p.includes("jeruk")) {
    style.bgColor = "1a120a"; style.titleColor = "ff9933"; style.textColor = "FFFFFF"; style.accentColor = "ff6600";
  } else if (p.includes("yellow") || p.includes("kuning") || p.includes("gold") || p.includes("golden")) {
    style.bgColor = "1a1a0a"; style.titleColor = "ffd700"; style.textColor = "1a1a2e"; style.accentColor = "daa520";
  } else if (p.includes("cyberpunk") || p.includes("hacker") || p.includes("neon")) {
    style.bgColor = "0a0a0a"; style.titleColor = "00ff41"; style.textColor = "00ff41"; style.accentColor = "ff00ff";
  } else if (p.includes("dark") || p.includes("gelap")) {
    style.bgColor = "0a0a0a"; style.titleColor = "FFFFFF"; style.textColor = "CCCCCC"; style.accentColor = "888888";
  } else if (p.includes("light") || p.includes("putih") || p.includes("clean") || p.includes("minimal")) {
    style.bgColor = "FFFFFF"; style.titleColor = "1a1a2e"; style.textColor = "333333"; style.accentColor = "0066cc";
  } else if (p.includes("corporate") || p.includes("professional") || p.includes("bisnis")) {
    style.bgColor = "0d1b2a"; style.titleColor = "e0e1dd"; style.textColor = "FFFFFF"; style.accentColor = "1b4965";
  } else if (p.includes("gradient")) {
    style.bgColor = "1a0a2e"; style.titleColor = "a855f7"; style.textColor = "FFFFFF"; style.accentColor = "6366f1";
  } else {
    const colorMap: Record<string, Partial<StyleConfig>> = {
      "black": { bgColor: "0a0a0a", titleColor: "FFFFFF", textColor: "CCCCCC", accentColor: "666666" },
      "white": { bgColor: "FFFFFF", titleColor: "1a1a2e", textColor: "333333", accentColor: "0066cc" },
      "gray": { bgColor: "1a1a1a", titleColor: "dddddd", textColor: "FFFFFF", accentColor: "888888" },
      "grey": { bgColor: "1a1a1a", titleColor: "dddddd", textColor: "FFFFFF", accentColor: "888888" },
      "teal": { bgColor: "0a1a1a", titleColor: "4ecdc4", textColor: "FFFFFF", accentColor: "20b2aa" },
      "cyan": { bgColor: "0a1a1a", titleColor: "00ffff", textColor: "FFFFFF", accentColor: "00cccc" },
      "magenta": { bgColor: "1a0a1a", titleColor: "ff00ff", textColor: "FFFFFF", accentColor: "cc00cc" },
      "brown": { bgColor: "1a120a", titleColor: "d2691e", textColor: "FFFFFF", accentColor: "8b4513" },
      "maroon": { bgColor: "1a0a0a", titleColor: "ff6666", textColor: "FFFFFF", accentColor: "800000" },
      "navy": { bgColor: "0a0a1a", titleColor: "6699cc", textColor: "FFFFFF", accentColor: "003366" },
      "lime": { bgColor: "0a1a0a", titleColor: "00ff00", textColor: "FFFFFF", accentColor: "00cc00" },
      "olive": { bgColor: "1a1a0a", titleColor: "bdb76b", textColor: "FFFFFF", accentColor: "808000" },
      "aqua": { bgColor: "0a1a1a", titleColor: "00ffff", textColor: "FFFFFF", accentColor: "00cccc" },
      "silver": { bgColor: "1a1a1a", titleColor: "c0c0c0", textColor: "FFFFFF", accentColor: "a0a0a0" },
    };
    for (const [color, config] of Object.entries(colorMap)) {
      if (p.includes(color)) { Object.assign(style, config); break; }
    }
  }

  if (p.includes("center") || p.includes(" tengah")) style.layout = "centered";
  if (p.includes("left") || p.includes(" kiri")) style.layout = "left-aligned";
  if (p.includes("right") || p.includes(" kanan")) style.layout = "left-aligned";

  if (p.includes("big title") || p.includes("large") || p.includes("besar")) style.titleSize = 56;
  if (p.includes("small") || p.includes("kecil")) style.titleSize = 38;

  if (p.includes("serif") || p.includes("formal")) style.fontFamily = "Georgia";
  if (p.includes("mono") || p.includes("code") || p.includes("terminal")) style.fontFamily = "Courier New";
  if (p.includes("modern") || p.includes("sans")) style.fontFamily = "Helvetica";

  return style;
}

async function checkPptRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().split("T")[0];
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM ppt_rate_limits WHERE user_id = $1 AND export_date = $2`,
    [userId, today]
  );
  const count = parseInt(result.rows[0]?.count || "0");
  if (count >= 5) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: 5 - count - 1 };
}

async function recordPptExport(userId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  await pool.query(
    `INSERT INTO ppt_rate_limits (user_id, export_date, created_at) VALUES ($1, $2, NOW())`,
    [userId, today]
  );
}

export async function POST(req: NextRequest) {
  try {
    const uid = getFirebaseUid(req);
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getUserByFirebaseUid(uid);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { report_id, format, style_prompt } = await req.json();
    if (!report_id || !format) return NextResponse.json({ error: "Missing report_id or format" }, { status: 400 });

    const ownership = await pool.query("SELECT * FROM reports WHERE id = $1 AND user_id = $2", [report_id, user.id]);
    if (ownership.rows.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const report = ownership.rows[0];
    const content = report.content || {};

    if (format === "json") {
      return new NextResponse(JSON.stringify(content, null, 2), {
        headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="nesti-report-${report.id}.json"` },
      });
    }

    if (format === "csv") {
      const rows = ["Category,Finding,Severity,Description,Impact,Recommendation"];
      const findings = content.findings || [];
      for (const f of findings) {
        rows.push(`"${f.category || ""}","${f.finding || f.title || ""}","${f.severity || ""}","${f.what_happened || f.description || ""}","${f.potential_impact || f.impact || ""}","${f.recommendation || ""}"`);
      }
      return new NextResponse(rows.join("\n"), {
        headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="nesti-report-${report.id}.csv"` },
      });
    }

    if (format === "pdf") return await generatePDF(report, content);
    if (format === "docx") return await generateDOCX(report, content);
    if (format === "xlsx") return await generateXLSX(report, content);

    if (format === "pptx") {
      if (style_prompt && style_prompt.trim()) {
        const rateCheck = await checkPptRateLimit(user.id);
        if (!rateCheck.allowed) {
          return NextResponse.json({ error: "Batas custom PPT hari ini sudah habis (5/hari). Coba lagi besok." }, { status: 429 });
        }
      }

      let styleConfig = getDefaultStyle();
      let usedAI = false;
      if (style_prompt && style_prompt.trim()) {
        const aiStyle = await getStyleFromAI(style_prompt);
        if (aiStyle) {
          styleConfig = { ...styleConfig, ...aiStyle };
          usedAI = true;
        } else {
          const localStyle = parseStyleFromPrompt(style_prompt);
          styleConfig = { ...styleConfig, ...localStyle };
        }
      }
      await recordPptExport(user.id);
      const response = await generatePPTX(report, content, styleConfig);
      if (usedAI) {
        response.headers.set("X-Style-Source", "ai");
      }
      return response;
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generatePDF(report: any, content: any) {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 50, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  doc.fontSize(28).font("Helvetica-Bold").text("NESTI", { align: "center" });
  doc.fontSize(16).font("Helvetica").text("Security Assessment Report", { align: "center" });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  doc.fontSize(12).font("Helvetica-Bold").text("Target: ");
  doc.font("Helvetica").text(report.target_url);
  doc.font("Helvetica-Bold").text("Date: ");
  doc.font("Helvetica").text(new Date(report.created_at).toLocaleDateString());
  doc.font("Helvetica-Bold").text("Type: ");
  doc.font("Helvetica").text(report.report_type?.toUpperCase() || "FULL");
  doc.moveDown();

  if (content.executive_summary) {
    doc.fontSize(14).font("Helvetica-Bold").text("Executive Summary");
    doc.fontSize(11).font("Helvetica").text(content.executive_summary);
    doc.moveDown();
  }

  if (content.risk_summary) {
    doc.fontSize(14).font("Helvetica-Bold").text("Risk Assessment");
    doc.fontSize(11).font("Helvetica").text("Level: " + (content.risk_summary.level || "N/A"));
    doc.text("Meaning: " + (content.risk_summary.meaning || "N/A"));
    if (content.risk_summary.reasons?.length > 0) {
      doc.text("Reasons:");
      for (const r of content.risk_summary.reasons) doc.text("  - " + r);
    }
    doc.moveDown();
  }

  const findings = content.findings || [];
  if (findings.length > 0) {
    doc.fontSize(14).font("Helvetica-Bold").text("Security Findings (" + findings.length + ")");
    doc.moveDown(0.3);
    for (const f of findings) {
      doc.fontSize(11).font("Helvetica-Bold").text("[" + f.severity + "] " + (f.finding || f.title || "Finding"));
      doc.fontSize(10).font("Helvetica");
      if (f.what_happened) doc.text("What: " + f.what_happened);
      if (f.why_it_matters) doc.text("Why: " + f.why_it_matters);
      if (f.potential_impact) doc.text("Impact: " + f.potential_impact);
      if (f.recommendation) doc.text("Fix: " + f.recommendation);
      doc.moveDown(0.5);
    }
  }

  if (content.web_updates?.length > 0) {
    doc.fontSize(14).font("Helvetica-Bold").text("Recommended Updates");
    doc.moveDown(0.3);
    for (const u of content.web_updates) {
      doc.fontSize(11).font("Helvetica-Bold").text("[" + u.priority + "] " + u.title);
      doc.fontSize(10).font("Helvetica").text(u.description);
      if (u.how_to_fix) doc.text("Fix: " + u.how_to_fix);
      doc.moveDown(0.5);
    }
  }

  doc.moveDown();
  doc.fontSize(9).font("Helvetica").fillColor("#888").text("Generated by Nesti - AI Web Security Analyst", { align: "center" });

  const pdfBuffer = Buffer.concat(chunks);
  return new NextResponse(pdfBuffer, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="nesti-report-${report.id}.pdf"` },
  });
}

async function generateDOCX(report: any, content: any) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TableRow, TableCell, Table, WidthType, ShadingType } = await import("docx");

  const findings = content.findings || [];
  const docChildren: any[] = [];

  docChildren.push(new Paragraph({ children: [new TextRun({ text: "NESTI", bold: true, size: 56 })], alignment: AlignmentType.CENTER }));
  docChildren.push(new Paragraph({ children: [new TextRun({ text: "Security Assessment Report", size: 28 })], alignment: AlignmentType.CENTER }));
  docChildren.push(new Paragraph({ children: [] }));
  docChildren.push(new Paragraph({ children: [new TextRun({ text: "Target: ", bold: true, size: 22 }), new TextRun({ text: report.target_url, size: 22 })] }));
  docChildren.push(new Paragraph({ children: [new TextRun({ text: "Date: ", bold: true, size: 22 }), new TextRun({ text: new Date(report.created_at).toLocaleDateString(), size: 22 })] }));
  docChildren.push(new Paragraph({ children: [new TextRun({ text: "Type: ", bold: true, size: 22 }), new TextRun({ text: report.report_type?.toUpperCase() || "FULL", size: 22 })] }));
  docChildren.push(new Paragraph({ children: [] }));

  if (content.executive_summary) {
    docChildren.push(new Paragraph({ children: [new TextRun({ text: "Executive Summary", bold: true, size: 28 })], heading: HeadingLevel.HEADING_1 }));
    docChildren.push(new Paragraph({ children: [new TextRun({ text: content.executive_summary, size: 22 })] }));
    docChildren.push(new Paragraph({ children: [] }));
  }

  if (content.risk_summary) {
    docChildren.push(new Paragraph({ children: [new TextRun({ text: "Risk Assessment", bold: true, size: 28 })], heading: HeadingLevel.HEADING_1 }));
    docChildren.push(new Paragraph({ children: [new TextRun({ text: "Level: " + (content.risk_summary.level || "N/A"), bold: true, size: 22 })] }));
    docChildren.push(new Paragraph({ children: [new TextRun({ text: content.risk_summary.meaning || "", size: 22 })] }));
    docChildren.push(new Paragraph({ children: [] }));
  }

  if (findings.length > 0) {
    docChildren.push(new Paragraph({ children: [new TextRun({ text: "Security Findings (" + findings.length + ")", bold: true, size: 28 })], heading: HeadingLevel.HEADING_1 }));
    const headerRow = new TableRow({
      children: ["Severity", "Finding", "Impact", "Recommendation"].map(h =>
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: "FFFFFF" })] })], shading: { fill: "1a1a2e", type: ShadingType.CLEAR, color: "auto" } })
      ),
    });
    const dataRows = findings.map((f: any) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: f.severity || "LOW", bold: true, size: 18 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: f.finding || f.title || "", size: 18 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: f.potential_impact || f.impact || "", size: 18 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: f.recommendation || "", size: 18 })] })] }),
      ],
    }));
    docChildren.push(new Table({ rows: [headerRow, ...dataRows] }));
    docChildren.push(new Paragraph({ children: [] }));
  }

  if (content.web_updates?.length > 0) {
    docChildren.push(new Paragraph({ children: [new TextRun({ text: "Recommended Updates", bold: true, size: 28 })], heading: HeadingLevel.HEADING_1 }));
    for (const u of content.web_updates) {
      docChildren.push(new Paragraph({ children: [new TextRun({ text: "[" + u.priority + "] " + u.title, bold: true, size: 22 })] }));
      docChildren.push(new Paragraph({ children: [new TextRun({ text: u.description, size: 20 })] }));
      if (u.how_to_fix) docChildren.push(new Paragraph({ children: [new TextRun({ text: "Fix: " + u.how_to_fix, size: 20, italics: true })] }));
      docChildren.push(new Paragraph({ children: [] }));
    }
  }

  docChildren.push(new Paragraph({ children: [new TextRun({ text: "Generated by Nesti - AI Web Security Analyst", size: 16, color: "888888", italics: true })], alignment: AlignmentType.CENTER }));

  const doc = new Document({ sections: [{ children: docChildren }] });
  const buffer = await Packer.toBuffer(doc);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="nesti-report-${report.id}.docx"` },
  });
}

async function generateXLSX(report: any, content: any) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.default.Workbook();
  workbook.creator = "Nesti Security Analyst";

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Field", key: "field", width: 20 },
    { header: "Value", key: "value", width: 60 },
  ];
  summarySheet.addRow({ field: "Target", value: report.target_url });
  summarySheet.addRow({ field: "Date", value: new Date(report.created_at).toLocaleDateString() });
  summarySheet.addRow({ field: "Type", value: report.report_type?.toUpperCase() });
  summarySheet.addRow({ field: "Risk Level", value: content.risk_summary?.level || "N/A" });
  summarySheet.addRow({ field: "Summary", value: content.executive_summary || "" });
  summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  const findingsSheet = workbook.addWorksheet("Findings");
  findingsSheet.columns = [
    { header: "Severity", key: "severity", width: 12 },
    { header: "Finding", key: "finding", width: 40 },
    { header: "What Happened", key: "what", width: 40 },
    { header: "Why It Matters", key: "why", width: 40 },
    { header: "Impact", key: "impact", width: 40 },
    { header: "Recommendation", key: "fix", width: 40 },
  ];
  findingsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
  findingsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const f of content.findings || []) {
    findingsSheet.addRow({
      severity: f.severity || "LOW",
      finding: f.finding || f.title || "",
      what: f.what_happened || f.description || "",
      why: f.why_it_matters || "",
      impact: f.potential_impact || f.impact || "",
      fix: f.recommendation || "",
    });
  }

  if (content.web_updates?.length > 0) {
    const updatesSheet = workbook.addWorksheet("Updates");
    updatesSheet.columns = [
      { header: "Priority", key: "priority", width: 12 },
      { header: "Category", key: "category", width: 20 },
      { header: "Title", key: "title", width: 40 },
      { header: "Description", key: "desc", width: 50 },
      { header: "How to Fix", key: "fix", width: 50 },
    ];
    updatesSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
    updatesSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    for (const u of content.web_updates) {
      updatesSheet.addRow({ priority: u.priority, category: u.category, title: u.title, desc: u.description, fix: u.how_to_fix });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="nesti-report-${report.id}.xlsx"` },
  });
}

async function generatePPTX(report: any, content: any, style?: StyleConfig) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.author = "Nesti Security Analyst";
  pptx.title = "Security Report - " + report.target_url;

  const s = style || getDefaultStyle();
  const riskColor = content.risk_summary?.level === "High" ? "ff6b6b" : content.risk_summary?.level === "Medium" ? "ff9f43" : "22c55e";
  const align = s.layout === "left-aligned" ? "left" : "center";
  const xPad = s.layout === "left-aligned" ? 0.5 : 0;
  const textW = s.layout === "left-aligned" ? "90%" : "100%";

  const slide1 = pptx.addSlide();
  slide1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: s.bgColor } });
  slide1.addText("NESTI", { x: xPad, y: 1.5, w: textW, h: 1, fontSize: s.titleSize, bold: true, color: s.titleColor, align, fontFace: s.fontFamily });
  slide1.addText("Security Assessment Report", { x: xPad, y: 2.5, w: textW, h: 0.8, fontSize: 24, color: s.textColor, align, fontFace: s.fontFamily });
  slide1.addText("Target: " + report.target_url, { x: xPad, y: 3.5, w: textW, h: 0.5, fontSize: 16, color: s.accentColor, align, fontFace: s.fontFamily });
  slide1.addText(new Date(report.created_at).toLocaleDateString(), { x: xPad, y: 4.2, w: textW, h: 0.5, fontSize: 14, color: "aaaaaa", align, fontFace: s.fontFamily });

  if (content.risk_summary) {
    const slide2 = pptx.addSlide();
    slide2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: s.bgColor } });
    slide2.addText("Risk Assessment", { x: 0.5, y: 0.3, w: "90%", h: 0.8, fontSize: 28, bold: true, color: s.titleColor, fontFace: s.fontFamily });
    slide2.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.2, w: 3, h: 1.2, fill: { color: riskColor } });
    slide2.addText(content.risk_summary.level || "N/A", { x: 0.5, y: 1.2, w: 3, h: 1.2, fontSize: 24, bold: true, color: "FFFFFF", align: "center", valign: "middle", fontFace: s.fontFamily });
    slide2.addText(content.risk_summary.meaning || "", { x: 0.5, y: 2.8, w: "90%", h: 0.8, fontSize: 16, color: s.textColor, fontFace: s.fontFamily });
    if (content.risk_summary.reasons?.length > 0) {
      slide2.addText("Reasons:", { x: 0.5, y: 3.8, w: "90%", h: 0.4, fontSize: 14, bold: true, color: s.titleColor, fontFace: s.fontFamily });
      slide2.addText(content.risk_summary.reasons.map((r: string) => "- " + r).join("\n"), { x: 0.5, y: 4.2, w: "90%", h: 1.5, fontSize: 12, color: s.textColor, fontFace: s.fontFamily });
    }
  }

  const findings = content.findings || [];
  if (findings.length > 0) {
    const slide3 = pptx.addSlide();
    slide3.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: s.bgColor } });
    slide3.addText("Security Findings (" + findings.length + ")", { x: 0.5, y: 0.3, w: "90%", h: 0.8, fontSize: 28, bold: true, color: s.titleColor, fontFace: s.fontFamily });
    let yPos = 1.2;
    for (const f of findings.slice(0, 6)) {
      const sevColor = (f.severity || "").toLowerCase() === "high" ? "ff6b6b" : (f.severity || "").toLowerCase() === "medium" ? "ff9f43" : "22c55e";
      slide3.addShape(pptx.ShapeType.rect, { x: 0.5, y: yPos, w: 0.15, h: 0.5, fill: { color: sevColor } });
      slide3.addText("[" + (f.severity || "LOW") + "] " + (f.finding || f.title || ""), { x: 0.8, y: yPos, w: "85%", h: 0.3, fontSize: 11, bold: true, color: s.titleColor, fontFace: s.fontFamily });
      slide3.addText((f.recommendation || "").substring(0, 80), { x: 0.8, y: yPos + 0.28, w: "85%", h: 0.3, fontSize: 9, color: s.textColor, fontFace: s.fontFamily });
      yPos += 0.6;
      if (yPos > 4.5) break;
    }
  }

  if (content.web_updates?.length > 0) {
    const slide4 = pptx.addSlide();
    slide4.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: s.bgColor } });
    slide4.addText("Recommended Updates", { x: 0.5, y: 0.3, w: "90%", h: 0.8, fontSize: 28, bold: true, color: s.titleColor, fontFace: s.fontFamily });
    let yPos = 1.2;
    for (const u of content.web_updates.slice(0, 5)) {
      slide4.addText("[" + u.priority + "] " + u.title, { x: 0.5, y: yPos, w: "90%", h: 0.4, fontSize: 14, bold: true, color: s.titleColor, fontFace: s.fontFamily });
      slide4.addText(u.description.substring(0, 100), { x: 0.5, y: yPos + 0.35, w: "90%", h: 0.4, fontSize: 11, color: s.textColor, fontFace: s.fontFamily });
      yPos += 0.85;
    }
  }

  const slideEnd = pptx.addSlide();
  slideEnd.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: s.bgColor } });
  slideEnd.addText("Generated by Nesti", { x: 0, y: 2.2, w: "100%", h: 0.8, fontSize: 28, bold: true, color: s.titleColor, align: "center", fontFace: s.fontFamily });
  slideEnd.addText("AI Web Security Analyst", { x: 0, y: 3, w: "100%", h: 0.6, fontSize: 16, color: s.accentColor, align: "center", fontFace: s.fontFamily });

  const buffer = await pptx.write({ outputType: "nodebuffer" }) as Buffer;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": `attachment; filename="nesti-report-${report.id}.pptx"` },
  });
}
