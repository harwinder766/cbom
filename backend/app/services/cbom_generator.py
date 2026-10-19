import uuid
import datetime
import io
import csv
from typing import List, Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from backend.app.models.artefact import Artefact
from backend.app.models.scan import Scan

VALID_PRIMITIVES = {
    'drbg', 'mac', 'block-cipher', 'stream-cipher', 'signature', 'hash',
    'pke', 'xof', 'kdf', 'key-agree', 'kem', 'ae', 'combiner', 'other', 'unknown'
}

VALID_MODES = {'cbc', 'ecb', 'ccm', 'gcm', 'cfb', 'ofb', 'ctr', 'other', 'unknown'}

def generate_cyclonedx_cbom(scan: Scan, artefacts: List[Artefact]) -> Dict[str, Any]:
    """Generates strictly valid CycloneDX 1.6 CBOM JSON specification."""
    components = []

    for art in artefacts:
        # CycloneDX 1.6 assetType enum: ['algorithm', 'certificate', 'protocol', 'related-crypto-material']
        if art.type == "certificate":
            asset_type = "certificate"
        elif art.type == "protocol":
            asset_type = "protocol"
        elif art.type in ("key", "related-crypto-material"):
            asset_type = "related-crypto-material"
        else:
            asset_type = "algorithm"

        crypto_props: Dict[str, Any] = {
            "assetType": asset_type
        }

        if art.oid:
            crypto_props["oid"] = art.oid

        if asset_type == "algorithm":
            # Map algorithm_class to CycloneDX primitive enum
            algo_cls = (art.algorithm_class or "").lower()
            if algo_cls in ("asymmetric", "asym"):
                primitive = "pke"
                crypto_funcs = ["keygen", "encrypt", "sign"]
            elif algo_cls in ("symmetric", "sym"):
                primitive = "block-cipher"
                crypto_funcs = ["encrypt", "decrypt"]
            elif algo_cls == "hash":
                primitive = "hash"
                crypto_funcs = ["digest"]
            elif algo_cls == "mac":
                primitive = "mac"
                crypto_funcs = ["tag", "verify"]
            elif algo_cls == "kdf":
                primitive = "kdf"
                crypto_funcs = ["keyderive"]
            elif algo_cls in VALID_PRIMITIVES:
                primitive = algo_cls
                crypto_funcs = ["encrypt"]
            else:
                primitive = "unknown"
                crypto_funcs = ["other"]

            algo_props: Dict[str, Any] = {
                "primitive": primitive,
                "cryptoFunctions": crypto_funcs
            }

            if art.key_size:
                algo_props["parameterSetIdentifier"] = f"{art.key_size}-bit"

            if art.mode and art.mode.lower() in VALID_MODES:
                algo_props["mode"] = art.mode.lower()

            crypto_props["algorithmProperties"] = algo_props

        elif asset_type == "certificate":
            crypto_props["certificateProperties"] = {
                "subjectName": art.name,
                "certificateFormat": "X.509"
            }

        elif asset_type == "protocol":
            crypto_props["protocolProperties"] = {
                "type": "tls",
                "version": art.version or "1.2"
            }

        elif asset_type == "related-crypto-material":
            mat_type = "key"
            if "private" in (art.name or "").lower():
                mat_type = "private-key"
            elif "public" in (art.name or "").lower():
                mat_type = "public-key"
            elif "secret" in (art.name or "").lower():
                mat_type = "secret-key"

            mat_props: Dict[str, Any] = {
                "type": mat_type
            }
            if art.key_size:
                mat_props["size"] = art.key_size
            crypto_props["relatedCryptoMaterialProperties"] = mat_props

        comp = {
            "type": "cryptographic-asset",
            "bom-ref": art.id,
            "name": art.name,
            "evidence": {
                "occurrences": [
                    {
                        "location": art.path,
                        "line": art.line or 1
                    }
                ]
            },
            "cryptoProperties": crypto_props
        }
        components.append(comp)

    # In CycloneDX 1.6, root additionalProperties is false, so $schema is omitted
    return {
        "bomFormat": "CycloneDX",
        "specVersion": "1.6",
        "serialNumber": f"urn:uuid:{uuid.uuid4()}",
        "version": 1,
        "metadata": {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "tools": {
                "components": [
                    {
                        "type": "application",
                        "author": "NTRO / ECDAT CBOM Engine",
                        "name": "Enterprise Cryptographic Discovery & Analysis Tool",
                        "version": "1.4.2"
                    }
                ]
            },
            "component": {
                "type": "application",
                "name": scan.target,
                "version": "1.0.0"
            }
        },
        "components": components
    }

def generate_csv_report(artefacts: List[Artefact]) -> str:
    """Generates CSV string export of cryptographic assets."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Artefact ID",
        "Name",
        "Type",
        "Class",
        "Location",
        "Line",
        "Quantum Vulnerable",
        "Risk Level",
        "Criticality",
        "Detection Method",
        "Key Size",
        "Mode",
        "PQC Replacement",
        "Evidence Snippet"
    ])

    for art in artefacts:
        writer.writerow([
            art.id,
            art.name,
            art.type,
            art.algorithm_class,
            art.path,
            art.line or "",
            "Yes" if art.quantum_vulnerable else "No",
            art.risk_level.upper(),
            art.business_criticality.upper(),
            art.detection_method,
            art.key_size or "",
            art.mode or "",
            art.replacement or "N/A",
            (art.evidence or "").replace("\n", " ")
        ])

    return output.getvalue()

def generate_html_report(scan: Scan, artefacts: List[Artefact]) -> str:
    """Generates a print-optimised executive HTML summary report."""
    critical_count = sum(1 for a in artefacts if a.risk_level == "critical")
    high_count = sum(1 for a in artefacts if a.risk_level == "high")
    quantum_vuln = sum(1 for a in artefacts if a.quantum_vulnerable)

    rows = ""
    for a in artefacts:
        badge_color = "#ef4444" if a.risk_level == "critical" else "#f59e0b" if a.risk_level == "high" else "#3b82f6" if a.risk_level == "medium" else "#64748b"
        rows += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #334155;"><strong>{a.name}</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #334155;">{a.type}</td>
            <td style="padding: 10px; border-bottom: 1px solid #334155;"><span style="background:{badge_color}; color:#fff; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:11px;">{a.risk_level.upper()}</span></td>
            <td style="padding: 10px; border-bottom: 1px solid #334155; font-family:monospace;">{a.path}{(':' + str(a.line)) if a.line else ''}</td>
            <td style="padding: 10px; border-bottom: 1px solid #334155; color:#10b981;">{a.replacement or 'N/A'}</td>
        </tr>
        """

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>ECDAT Executive Cryptographic Bill of Materials (CBOM)</title>
    <style>
        @media print {{
            body {{ background: #fff !important; color: #000 !important; padding: 0 !important; }}
            .container {{ max-width: 100% !important; border: none !important; padding: 0 !important; }}
            .stat-card {{ border: 1px solid #ccc !important; background: #f8fafc !important; color: #000 !important; }}
            .stat-num {{ color: #000 !important; }}
            th {{ background: #f1f5f9 !important; color: #000 !important; border-bottom: 2px solid #000 !important; }}
            td {{ border-bottom: 1px solid #ddd !important; color: #000 !important; }}
            a {{ text-decoration: none; color: #000; }}
        }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }}
        .container {{ max-width: 1000px; margin: auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155; }}
        h1 {{ margin-top: 0; font-size: 24px; color: #fff; }}
        .stat-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 25px 0; }}
        .stat-card {{ background: #0f172a; padding: 15px; border-radius: 8px; border: 1px solid #334155; }}
        .stat-num {{ font-size: 28px; font-weight: bold; margin-top: 5px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }}
        th {{ text-align: left; padding: 10px; background: #0f172a; border-bottom: 2px solid #334155; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Enterprise Cryptographic Discovery & Analysis Tool (ECDAT)</h1>
        <p style="color:#94a3b8; font-size:13px;">Target: <strong>{scan.target}</strong> | Generated: {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')} | Spec: CycloneDX 1.6</p>
        
        <div class="stat-grid">
            <div class="stat-card">
                <div style="color:#94a3b8; font-size:12px;">Total Cryptographic Assets</div>
                <div class="stat-num">{len(artefacts)}</div>
            </div>
            <div class="stat-card">
                <div style="color:#ef4444; font-size:12px;">Critical Risk Findings</div>
                <div class="stat-num" style="color:#ef4444;">{critical_count}</div>
            </div>
            <div class="stat-card">
                <div style="color:#f59e0b; font-size:12px;">High Risk Findings</div>
                <div class="stat-num" style="color:#f59e0b;">{high_count}</div>
            </div>
            <div class="stat-card">
                <div style="color:#a855f7; font-size:12px;">Quantum-Vulnerable (Shor)</div>
                <div class="stat-num" style="color:#a855f7;">{quantum_vuln}</div>
            </div>
        </div>

        <h2>Discovered Cryptographic Assets & NIST PQC Migration Roadmap</h2>
        <table>
            <thead>
                <tr>
                    <th>Artefact Name</th>
                    <th>Type</th>
                    <th>Risk Level</th>
                    <th>File Location</th>
                    <th>Recommended PQC Replacement</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
    </div>
</body>
</html>"""

def generate_pdf_report(scan: Scan, artefacts: List[Artefact]) -> bytes:
    """Generates an executive PDF report using ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=14
    )
    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=12,
        spaceAfter=8
    )
    cell_style = ParagraphStyle(
        'DocCell',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b")
    )
    cell_bold = ParagraphStyle(
        'DocCellBold',
        parent=cell_style,
        fontName='Helvetica-Bold'
    )
    cell_mono = ParagraphStyle(
        'DocCellMono',
        parent=cell_style,
        fontName='Courier',
        fontSize=7,
        leading=9
    )

    elements = []

    # Title & Subtitle
    elements.append(Paragraph("Enterprise Cryptographic Discovery & Analysis Tool (ECDAT)", title_style))
    meta_text = f"Target: <b>{scan.target}</b> | Generated: {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')} | Spec: CycloneDX 1.6 CBOM"
    elements.append(Paragraph(meta_text, subtitle_style))

    # Metrics Summary Table
    critical_count = sum(1 for a in artefacts if a.risk_level == "critical")
    high_count = sum(1 for a in artefacts if a.risk_level == "high")
    quantum_vuln = sum(1 for a in artefacts if a.quantum_vulnerable)

    stat_data = [
        ["Total Assets", "Critical Risk", "High Risk", "Quantum-Vulnerable"],
        [str(len(artefacts)), str(critical_count), str(high_count), str(quantum_vuln)]
    ]
    stat_table = Table(stat_data, colWidths=[135, 135, 135, 135])
    stat_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#475569")),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
        ('TOPPADDING', (0, 0), (-1, 0), 4),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 14),
        ('TEXTCOLOR', (1, 1), (1, 1), colors.HexColor("#dc2626")),
        ('TEXTCOLOR', (2, 1), (2, 1), colors.HexColor("#d97706")),
        ('TEXTCOLOR', (3, 1), (3, 1), colors.HexColor("#7c3aed")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0, 1), (-1, 1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 6),
    ]))
    elements.append(stat_table)
    elements.append(Spacer(1, 12))

    # Findings Table
    elements.append(Paragraph("Discovered Cryptographic Assets & NIST PQC Roadmap", h2_style))

    findings_data = [
        [
            Paragraph("<b>Asset</b>", cell_style),
            Paragraph("<b>Type</b>", cell_style),
            Paragraph("<b>Risk</b>", cell_style),
            Paragraph("<b>Location</b>", cell_style),
            Paragraph("<b>PQC Recommendation</b>", cell_style)
        ]
    ]

    for a in artefacts[:100]: # Cap table at top 100 for clean pagination
        risk_color = "#dc2626" if a.risk_level == "critical" else "#d97706" if a.risk_level == "high" else "#2563eb" if a.risk_level == "medium" else "#64748b"
        risk_cell = Paragraph(f"<font color='{risk_color}'><b>{a.risk_level.upper()}</b></font>", cell_style)
        loc_str = f"{a.path}:{a.line}" if a.line else a.path
        if len(loc_str) > 35:
            loc_str = "..." + loc_str[-32:]

        findings_data.append([
            Paragraph(a.name, cell_bold),
            Paragraph(a.type, cell_style),
            risk_cell,
            Paragraph(loc_str, cell_mono),
            Paragraph(a.replacement or "N/A", cell_style)
        ])

    findings_table = Table(findings_data, colWidths=[110, 60, 50, 180, 140])
    findings_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    elements.append(findings_table)

    doc.build(elements)
    return buffer.getvalue()
