import os
import tempfile
from datetime import datetime, timezone, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from pptx import Presentation
from pptx.util import Inches as PptxInches, Pt as PptxPt
from pptx.dml.color import RGBColor as PptxRGB
from pptx.enum.text import PP_ALIGN

WIB = timezone(timedelta(hours=7))

NEO_BLACK = "#1a1a2e"
NEO_YELLOW = "#ffe66d"
NEO_PINK = "#ff6b6b"
NEO_CYAN = "#4ecdc4"
NEO_PURPLE = "#6c5ce7"
NEO_ORANGE = "#fdcb6e"


def now_wib():
    return datetime.now(WIB)


def fmt_time(dt):
    if dt is None:
        return "-"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(WIB).strftime("%d %b %Y %H:%M WIB")


def severity_color(sev):
    sev = sev.lower()
    if sev == "critical":
        return NEO_PINK
    elif sev == "high":
        return NEO_ORANGE
    elif sev == "medium":
        return NEO_YELLOW
    else:
        return NEO_CYAN


def generate_pdf(monitor_url, findings, scan_data, report_date) -> str:
    path = tempfile.mktemp(suffix=".pdf")
    doc = SimpleDocTemplate(path, pagesize=A4, topMargin=0.5 * inch, bottomMargin=0.5 * inch)
    styles = getSampleStyleSheet()
    elements = []

    title_style = styles["Title"]
    title_style.fontSize = 20
    title_style.textColor = HexColor(NEO_BLACK)

    elements.append(Paragraph("NESTI Security Report", title_style))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(f"<b>Target:</b> {monitor_url}", styles["Normal"]))
    elements.append(Paragraph(f"<b>Date:</b> {fmt_time(report_date)}", styles["Normal"]))
    elements.append(Paragraph(f"<b>Total Findings:</b> {len(findings)}", styles["Normal"]))
    elements.append(Spacer(1, 20))

    if findings:
        header_style = styles["Heading2"]
        header_style.textColor = HexColor(NEO_BLACK)
        elements.append(Paragraph("Findings", header_style))
        elements.append(Spacer(1, 10))

        table_data = [["#", "Severity", "Title", "Detail"]]
        for i, f in enumerate(findings[:20], 1):
            sev = f.get("severity", "-").upper()
            title = (f.get("title") or f.get("finding") or "-")[:60]
            detail = (f.get("detail") or f.get("description") or "-")[:80]
            table_data.append([str(i), sev, title, detail])

        table = Table(table_data, colWidths=[0.4 * inch, 0.8 * inch, 2.5 * inch, 3 * inch])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor(NEO_BLACK)),
            ("TEXTCOLOR", (0, 0), (-1, 0), HexColor(NEO_YELLOW)),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("GRID", (0, 0), (-1, -1), 1, HexColor(NEO_BLACK)),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#ffffff"), HexColor("#f8f8f8")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph("No findings detected. System is clean.", styles["Normal"]))

    if scan_data:
        elements.append(Spacer(1, 20))
        elements.append(Paragraph("Scan Details", styles["Heading2"]))
        elements.append(Spacer(1, 10))

        headers_info = scan_data.get("security_headers", {})
        if isinstance(headers_info, dict):
            hdr_data = [["Header", "Status"]]
            for h, v in headers_info.items():
                hdr_data.append([h, "Present" if v else "Missing"])
            hdr_table = Table(hdr_data, colWidths=[3 * inch, 2 * inch])
            hdr_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), HexColor(NEO_BLACK)),
                ("TEXTCOLOR", (0, 0), (-1, 0), HexColor(NEO_YELLOW)),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 1, HexColor(NEO_BLACK)),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#ffffff"), HexColor("#f8f8f8")]),
            ]))
            elements.append(hdr_table)

    doc.build(elements)
    return path


def generate_excel(monitor_url, findings, scan_data, report_date) -> str:
    path = tempfile.mktemp(suffix=".xlsx")
    wb = openpyxl.Workbook()

    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color=NEO_BLACK[1:], end_color=NEO_BLACK[1:], fill_type="solid")
    border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin"),
    )

    ws = wb.active
    ws.title = "Report"
    ws.column_dimensions["A"].width = 5
    ws.column_dimensions["B"].width = 12
    ws.column_dimensions["C"].width = 40
    ws.column_dimensions["D"].width = 60
    ws.column_dimensions["E"].width = 15

    meta = [
        ["NESTI Security Report"],
        [""],
        ["Target", monitor_url],
        ["Date", fmt_time(report_date)],
        ["Total Findings", str(len(findings))],
        [""],
    ]
    for row in meta:
        ws.append(row)

    ws["A1"].font = Font(bold=True, size=14, color=NEO_BLACK[1:])

    headers = ["#", "Severity", "Title", "Detail", "Remediation"]
    ws.append(headers)
    for col_idx, _ in enumerate(headers, 1):
        cell = ws.cell(row=ws.max_row, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.border = border

    for i, f in enumerate(findings[:50], 1):
        sev = f.get("severity", "-").upper()
        title = f.get("title") or f.get("finding") or "-"
        detail = f.get("detail") or f.get("description") or "-"
        remediation = f.get("remediation") or f.get("recommendation") or "-"
        row_data = [i, sev, title, detail, remediation]
        ws.append(row_data)
        for col_idx in range(1, len(row_data) + 1):
            cell = ws.cell(row=ws.max_row, column=col_idx)
            cell.border = border
            cell.alignment = Alignment(wrap_text=True)

    if scan_data:
        ws2 = wb.create_sheet("Security Headers")
        ws2.column_dimensions["A"].width = 35
        ws2.column_dimensions["B"].width = 15
        ws2.append(["Header", "Status"])
        for col_idx in range(1, 3):
            cell = ws2.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.border = border

        headers_info = scan_data.get("security_headers", {})
        if isinstance(headers_info, dict):
            for h, v in headers_info.items():
                ws2.append([h, "Present" if v else "Missing"])

    wb.save(path)
    return path


def generate_docx(monitor_url, findings, scan_data, report_date) -> str:
    path = tempfile.mktemp(suffix=".docx")
    doc = Document()

    style = doc.styles["Normal"]
    style.font.size = Pt(10)

    title = doc.add_heading("NESTI Security Report", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in title.runs:
        run.font.color.rgb = RGBColor(0x1A, 0x1A, 0x2E)

    doc.add_paragraph("")
    meta = doc.add_paragraph()
    meta.add_run("Target: ").bold = True
    meta.add_run(monitor_url)
    meta.add_run("\n")
    meta.add_run("Date: ").bold = True
    meta.add_run(fmt_time(report_date))
    meta.add_run("\n")
    meta.add_run("Total Findings: ").bold = True
    meta.add_run(str(len(findings)))

    doc.add_heading("Findings", level=1)

    if findings:
        table = doc.add_table(rows=1, cols=4)
        table.style = "Table Grid"
        hdr = table.rows[0].cells
        hdr[0].text = "#"
        hdr[1].text = "Severity"
        hdr[2].text = "Title"
        hdr[3].text = "Detail"
        for cell in hdr:
            for p in cell.paragraphs:
                for run in p.runs:
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            from docx.oxml.ns import qn
            shading_elm = cell._element.get_or_add_tcPr()
            shading = shading_elm.makeelement(qn("w:shd"), {
                qn("w:fill"): "1a1a2e",
                qn("w:val"): "clear",
            })
            shading_elm.append(shading)

        for i, f in enumerate(findings[:20], 1):
            row = table.add_row().cells
            row[0].text = str(i)
            row[1].text = f.get("severity", "-").upper()
            row[2].text = (f.get("title") or f.get("finding") or "-")[:60]
            row[3].text = (f.get("detail") or f.get("description") or "-")[:100]
    else:
        doc.add_paragraph("No findings detected. System is clean.")

    if scan_data:
        doc.add_heading("Security Headers", level=1)
        headers_info = scan_data.get("security_headers", {})
        if isinstance(headers_info, dict):
            table = doc.add_table(rows=1, cols=2)
            table.style = "Table Grid"
            hdr = table.rows[0].cells
            hdr[0].text = "Header"
            hdr[1].text = "Status"
            for cell in hdr:
                for p in cell.paragraphs:
                    for run in p.runs:
                        run.font.bold = True
            for h, v in headers_info.items():
                row = table.add_row().cells
                row[0].text = h
                row[1].text = "Present" if v else "Missing"

    doc.save(path)
    return path


def generate_pptx(monitor_url, findings, scan_data, report_date, style="cyberpunk") -> str:
    path = tempfile.mktemp(suffix=".pptx")
    prs = Presentation()
    prs.slide_width = PptxInches(13.333)
    prs.slide_height = PptxInches(7.5)

    if style == "cyberpunk":
        bg_color = PptxRGB(0x1A, 0x1A, 0x2E)
        accent = PptxRGB(0xFF, 0xE6, 0x6D)
        text_color = PptxRGB(0xFF, 0xFF, 0xFF)
        pink = PptxRGB(0xFF, 0x6B, 0x6B)
        cyan = PptxRGB(0x4E, 0xCD, 0xC4)
    else:
        bg_color = PptxRGB(0x1A, 0x1A, 0x2E)
        accent = PptxRGB(0x4E, 0xCD, 0xC4)
        text_color = PptxRGB(0xFF, 0xFF, 0xFF)
        pink = PptxRGB(0xFF, 0x6B, 0x6B)
        cyan = PptxRGB(0xFF, 0xE6, 0x6D)

    def set_bg(slide):
        bg = slide.background
        fill = bg.fill
        fill.solid()
        fill.fore_color.rgb = bg_color

    def add_text(slide, left, top, width, height, text, font_size=18, bold=False, color=text_color, align=PP_ALIGN.LEFT):
        txBox = slide.shapes.add_textbox(PptxInches(left), PptxInches(top), PptxInches(width), PptxInches(height))
        tf = txBox.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = text
        p.font.size = PptxPt(font_size)
        p.font.bold = bold
        p.font.color.rgb = color
        p.alignment = align
        return tf

    # Slide 1: Title
    slide1 = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide1)
    add_text(slide1, 1, 1.5, 11, 1.5, "NESTI", 60, True, accent, PP_ALIGN.CENTER)
    add_text(slide1, 1, 3, 11, 1, "SECURITY REPORT", 36, True, text_color, PP_ALIGN.CENTER)
    add_text(slide1, 1, 4.2, 11, 0.8, monitor_url, 20, False, cyan, PP_ALIGN.CENTER)
    add_text(slide1, 1, 5.5, 11, 0.6, fmt_time(report_date), 16, False, text_color, PP_ALIGN.CENTER)

    # Slide 2: Summary
    slide2 = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide2)
    add_text(slide2, 0.8, 0.5, 11, 1, "SUMMARY", 32, True, accent)

    critical = sum(1 for f in findings if f.get("severity", "").lower() == "critical")
    high = sum(1 for f in findings if f.get("severity", "").lower() == "high")
    medium = sum(1 for f in findings if f.get("severity", "").lower() == "medium")
    low = sum(1 for f in findings if f.get("severity", "").lower() == "low")
    info = sum(1 for f in findings if f.get("severity", "").lower() == "info")

    summary_items = [
        (f"Total Findings: {len(findings)}", text_color),
        (f"Critical: {critical}", pink if critical else text_color),
        (f"High: {high}", PptxRGB(0xFD, 0xCB, 0x6E) if high else text_color),
        (f"Medium: {medium}", accent if medium else text_color),
        (f"Low: {low}", cyan if low else text_color),
        (f"Info: {info}", text_color),
    ]
    y = 1.8
    for text, color in summary_items:
        add_text(slide2, 1.5, y, 10, 0.6, text, 22, False, color)
        y += 0.65

    # Slide 3+: Findings (max 5 per slide)
    if findings:
        chunks = [findings[i:i + 5] for i in range(0, len(findings), 15)]
        for chunk_idx, chunk in enumerate(chunks[:3]):
            slide = prs.slides.add_slide(prs.slide_layouts[6])
            set_bg(slide)
            title_text = f"FINDINGS ({chunk_idx * 15 + 1}-{min((chunk_idx + 1) * 15, len(findings))} of {len(findings)})"
            add_text(slide, 0.8, 0.5, 11, 1, title_text, 28, True, accent)

            y = 1.6
            for f in chunk:
                sev = f.get("severity", "?").upper()
                title = (f.get("title") or f.get("finding") or "?")[:50]
                detail = (f.get("detail") or f.get("description") or "?")[:70]

                if sev == "CRITICAL":
                    sev_color = pink
                elif sev == "HIGH":
                    sev_color = PptxRGB(0xFD, 0xCB, 0x6E)
                elif sev == "MEDIUM":
                    sev_color = accent
                else:
                    sev_color = cyan

                add_text(slide, 1, y, 1.5, 0.4, f"[{sev}]", 14, True, sev_color)
                add_text(slide, 2.8, y, 9, 0.4, title, 14, True, text_color)
                add_text(slide, 2.8, y + 0.4, 9, 0.4, detail, 11, False, PptxRGB(0xAA, 0xAA, 0xAA))
                y += 0.95

    # Last slide: Footer
    slide_end = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide_end)
    add_text(slide_end, 1, 2.5, 11, 1.5, "NESTI", 60, True, accent, PP_ALIGN.CENTER)
    add_text(slide_end, 1, 4, 11, 0.8, "AI Web Security Analyst", 24, False, text_color, PP_ALIGN.CENTER)
    add_text(slide_end, 1, 5.2, 11, 0.6, f"Report generated: {fmt_time(report_date)}", 14, False, PptxRGB(0x88, 0x88, 0x88), PP_ALIGN.CENTER)

    prs.save(path)
    return path
