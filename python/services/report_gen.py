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


THEMES = {
    "cyberpunk": {
        "bg": (0x1A, 0x1A, 0x2E),
        "accent": (0xFF, 0xE6, 0x6D),
        "text": (0xFF, 0xFF, 0xFF),
        "pink": (0xFF, 0x6B, 0x6B),
        "cyan": (0x4E, 0xCD, 0xC4),
        "muted": (0xAA, 0xAA, 0xAA),
        "footer": (0x88, 0x88, 0x88),
    },
    "neo-brutalism": {
        "bg": (0xFA, 0xFA, 0xFA),
        "accent": (0x1A, 0x1A, 0x2E),
        "text": (0x1A, 0x1A, 0x2E),
        "pink": (0xFF, 0x6B, 0x6B),
        "cyan": (0x4E, 0xCD, 0xC4),
        "muted": (0x66, 0x66, 0x66),
        "footer": (0x99, 0x99, 0x99),
        "border": (0x1A, 0x1A, 0x2E),
        "yellow": (0xFF, 0xE6, 0x6D),
        "green": (0x00, 0xB8, 0x94),
    },
    "cherry-blossom": {
        "bg": (0xFF, 0xF5, 0xF5),
        "accent": (0xE8, 0x6B, 0x8A),
        "text": (0x4A, 0x30, 0x38),
        "pink": (0xFF, 0x8B, 0xA1),
        "cyan": (0xD4, 0x8B, 0xB8),
        "muted": (0x99, 0x70, 0x7A),
        "footer": (0xBB, 0x99, 0xA3),
        "petal": (0xFF, 0xCC, 0xD5),
        "deep": (0x8B, 0x3A, 0x52),
    },
}


def generate_pptx(monitor_url, findings, scan_data, report_date, style="cyberpunk") -> str:
    path = tempfile.mktemp(suffix=".pptx")
    prs = Presentation()
    prs.slide_width = PptxInches(13.333)
    prs.slide_height = PptxInches(7.5)

    t = THEMES.get(style, THEMES["cyberpunk"])
    bg_rgb = PptxRGB(*t["bg"])
    accent_rgb = PptxRGB(*t["accent"])
    text_rgb = PptxRGB(*t["text"])
    pink_rgb = PptxRGB(*t["pink"])
    cyan_rgb = PptxRGB(*t["cyan"])
    muted_rgb = PptxRGB(*t["muted"])
    footer_rgb = PptxRGB(*t["footer"])

    def set_bg(slide, color=None):
        bg = slide.background
        fill = bg.fill
        fill.solid()
        fill.fore_color.rgb = color or bg_rgb

    def add_text(slide, left, top, width, height, text, font_size=18, bold=False, color=None, align=PP_ALIGN.LEFT):
        if color is None:
            color = text_rgb
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

    def add_shape_rect(slide, left, top, width, height, fill_color, line_color=None):
        from pptx.enum.shapes import MSO_SHAPE
        shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, PptxInches(left), PptxInches(top), PptxInches(width), PptxInches(height))
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill_color
        if line_color:
            shape.line.color.rgb = line_color
            shape.line.width = PptxPt(2)
        else:
            shape.line.fill.background()
        return shape

    # ============ SLIDES ============

    # Slide 1: Title
    slide1 = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide1)

    if style == "neo-brutalism":
        add_shape_rect(slide1, 0.8, 1.2, 11.7, 2.5, PptxRGB(*t["yellow"]), bg_rgb)
        add_text(slide1, 1, 1.4, 11.3, 1.2, "NESTI", 72, True, bg_rgb, PP_ALIGN.CENTER)
        add_text(slide1, 1, 2.6, 11.3, 0.8, "SECURITY REPORT", 32, True, bg_rgb, PP_ALIGN.CENTER)
        add_shape_rect(slide1, 3, 4.2, 7.3, 0.06, bg_rgb)
        add_text(slide1, 1, 4.6, 11.3, 0.6, monitor_url, 18, False, muted_rgb, PP_ALIGN.CENTER)
        add_text(slide1, 1, 5.4, 11.3, 0.6, fmt_time(report_date), 14, False, footer_rgb, PP_ALIGN.CENTER)
    elif style == "cherry-blossom":
        add_text(slide1, 1, 1.5, 11, 1.5, "~ NESTI ~", 60, True, accent_rgb, PP_ALIGN.CENTER)
        add_text(slide1, 1, 3.2, 11, 0.8, "Security Report", 30, False, text_rgb, PP_ALIGN.CENTER)
        add_shape_rect(slide1, 5, 4.2, 3.3, 0.04, accent_rgb)
        add_text(slide1, 1, 4.6, 11, 0.6, monitor_url, 18, False, muted_rgb, PP_ALIGN.CENTER)
        add_text(slide1, 1, 5.4, 11, 0.6, fmt_time(report_date), 14, False, footer_rgb, PP_ALIGN.CENTER)
    else:
        add_text(slide1, 1, 1.5, 11, 1.5, "NESTI", 60, True, accent_rgb, PP_ALIGN.CENTER)
        add_text(slide1, 1, 3, 11, 1, "SECURITY REPORT", 36, True, text_rgb, PP_ALIGN.CENTER)
        add_text(slide1, 1, 4.2, 11, 0.8, monitor_url, 20, False, cyan_rgb, PP_ALIGN.CENTER)
        add_text(slide1, 1, 5.5, 11, 0.6, fmt_time(report_date), 16, False, text_rgb, PP_ALIGN.CENTER)

    # Slide 2: Summary
    slide2 = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide2)

    critical = sum(1 for f in findings if f.get("severity", "").lower() == "critical")
    high = sum(1 for f in findings if f.get("severity", "").lower() == "high")
    medium = sum(1 for f in findings if f.get("severity", "").lower() == "medium")
    low = sum(1 for f in findings if f.get("severity", "").lower() == "low")
    info = sum(1 for f in findings if f.get("severity", "").lower() == "info")

    if style == "neo-brutalism":
        add_shape_rect(slide2, 0.8, 0.5, 5, 0.9, accent_rgb)
        add_text(slide2, 1, 0.55, 4.8, 0.8, "SUMMARY", 30, True, PptxRGB(*t["yellow"]))

        card_y = 1.8
        for label, count, c in [
            ("TOTAL", len(findings), accent_rgb),
            ("CRITICAL", critical, pink_rgb),
            ("HIGH", high, PptxRGB(*t["yellow"])),
            ("MEDIUM", medium, accent_rgb),
            ("LOW", low, cyan_rgb),
        ]:
            add_shape_rect(slide2, 1, card_y, 4.5, 0.7, PptxRGB(*t["bg"]), accent_rgb)
            add_text(slide2, 1.2, card_y + 0.1, 2.5, 0.5, label, 16, True, accent_rgb)
            add_text(slide2, 3.8, card_y + 0.1, 1.5, 0.5, str(count), 16, True, c, PP_ALIGN.RIGHT)
            card_y += 0.85
    elif style == "cherry-blossom":
        add_text(slide2, 0.8, 0.5, 11, 0.8, "~ Summary ~", 30, True, accent_rgb, PP_ALIGN.CENTER)
        card_y = 1.6
        for label, count, c in [
            ("Total Findings", len(findings), text_rgb),
            ("Critical", critical, pink_rgb),
            ("High", high, accent_rgb),
            ("Medium", medium, PptxRGB(*t["cyan"])),
            ("Low", low, PptxRGB(*t["muted"])),
        ]:
            add_shape_rect(slide2, 3.5, card_y, 6.3, 0.6, PptxRGB(*t["petal"]))
            add_text(slide2, 3.8, card_y + 0.08, 3, 0.45, label, 16, False, text_rgb)
            add_text(slide2, 7, card_y + 0.08, 2.5, 0.45, str(count), 16, True, c, PP_ALIGN.RIGHT)
            card_y += 0.72
    else:
        add_text(slide2, 0.8, 0.5, 11, 1, "SUMMARY", 32, True, accent_rgb)
        y = 1.8
        for text, color in [
            (f"Total Findings: {len(findings)}", text_rgb),
            (f"Critical: {critical}", pink_rgb if critical else text_rgb),
            (f"High: {high}", PptxRGB(0xFD, 0xCB, 0x6E) if high else text_rgb),
            (f"Medium: {medium}", accent_rgb if medium else text_rgb),
            (f"Low: {low}", cyan_rgb if low else text_rgb),
            (f"Info: {info}", text_rgb),
        ]:
            add_text(slide2, 1.5, y, 10, 0.6, text, 22, False, color)
            y += 0.65

    # Slide 3+: Findings
    if findings:
        chunks = [findings[i:i + 5] for i in range(0, len(findings), 15)]
        for chunk_idx, chunk in enumerate(chunks[:3]):
            slide = prs.slides.add_slide(prs.slide_layouts[6])
            set_bg(slide)
            title_text = f"FINDINGS ({chunk_idx * 15 + 1}-{min((chunk_idx + 1) * 15, len(findings))} of {len(findings)})"

            if style == "neo-brutalism":
                add_shape_rect(slide, 0.8, 0.4, 6, 0.8, accent_rgb)
                add_text(slide, 1, 0.45, 5.6, 0.7, title_text, 24, True, PptxRGB(*t["yellow"]))
            elif style == "cherry-blossom":
                add_text(slide, 0.8, 0.4, 11.5, 0.7, title_text, 24, True, accent_rgb, PP_ALIGN.CENTER)
            else:
                add_text(slide, 0.8, 0.5, 11, 1, title_text, 28, True, accent_rgb)

            y = 1.5
            for f in chunk:
                sev = f.get("severity", "?").upper()
                title = (f.get("title") or f.get("finding") or "?")[:50]
                detail = (f.get("detail") or f.get("description") or "?")[:70]

                sev_color = pink_rgb if sev == "CRITICAL" else PptxRGB(0xFD, 0xCB, 0x6E) if sev == "HIGH" else accent_rgb if sev == "MEDIUM" else cyan_rgb

                if style == "neo-brutalism":
                    add_shape_rect(slide, 0.8, y, 11.7, 0.85, PptxRGB(*t["bg"]), accent_rgb)
                    add_text(slide, 1, y + 0.05, 1.5, 0.35, f"[{sev}]", 12, True, sev_color)
                    add_text(slide, 2.8, y + 0.05, 9.5, 0.35, title, 13, True, text_rgb)
                    add_text(slide, 2.8, y + 0.42, 9.5, 0.35, detail, 10, False, muted_rgb)
                elif style == "cherry-blossom":
                    add_shape_rect(slide, 1, y, 11.3, 0.85, PptxRGB(*t["petal"]))
                    add_text(slide, 1.2, y + 0.05, 1.5, 0.35, f"[{sev}]", 12, True, sev_color)
                    add_text(slide, 3, y + 0.05, 9, 0.35, title, 13, True, text_rgb)
                    add_text(slide, 3, y + 0.42, 9, 0.35, detail, 10, False, muted_rgb)
                else:
                    add_text(slide, 1, y, 1.5, 0.4, f"[{sev}]", 14, True, sev_color)
                    add_text(slide, 2.8, y, 9, 0.4, title, 14, True, text_rgb)
                    add_text(slide, 2.8, y + 0.4, 9, 0.4, detail, 11, False, muted_rgb)
                y += 0.95

    # Last slide: Footer
    slide_end = prs.slides.add_slide(prs.slide_layouts[6])
    set_bg(slide_end)

    if style == "neo-brutalism":
        add_shape_rect(slide_end, 2, 2, 9.3, 3, accent_rgb, bg_rgb)
        add_text(slide_end, 2.3, 2.2, 8.7, 1.5, "NESTI", 72, True, bg_rgb, PP_ALIGN.CENTER)
        add_text(slide_end, 2.3, 3.8, 8.7, 0.8, "AI Web Security Analyst", 22, False, bg_rgb, PP_ALIGN.CENTER)
        add_text(slide_end, 2.3, 4.6, 8.7, 0.5, fmt_time(report_date), 13, False, PptxRGB(*t["muted"]), PP_ALIGN.CENTER)
    elif style == "cherry-blossom":
        add_text(slide_end, 1, 2.2, 11, 1.2, "~ NESTI ~", 60, True, accent_rgb, PP_ALIGN.CENTER)
        add_text(slide_end, 1, 3.8, 11, 0.8, "AI Web Security Analyst", 22, False, text_rgb, PP_ALIGN.CENTER)
        add_shape_rect(slide_end, 5, 4.8, 3.3, 0.04, accent_rgb)
        add_text(slide_end, 1, 5.2, 11, 0.6, fmt_time(report_date), 14, False, footer_rgb, PP_ALIGN.CENTER)
    else:
        add_text(slide_end, 1, 2.5, 11, 1.5, "NESTI", 60, True, accent_rgb, PP_ALIGN.CENTER)
        add_text(slide_end, 1, 4, 11, 0.8, "AI Web Security Analyst", 24, False, text_rgb, PP_ALIGN.CENTER)
        add_text(slide_end, 1, 5.2, 11, 0.6, f"Report generated: {fmt_time(report_date)}", 14, False, footer_rgb, PP_ALIGN.CENTER)

    prs.save(path)
    return path
