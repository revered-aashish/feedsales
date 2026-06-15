import PDFDocument from 'pdfkit';

const BRAND       = '#4338ca';   // indigo-700
const BRAND_DARK  = '#1e1b4b';   // indigo-950  — deep navy for header bg
const BRAND_MID   = '#3730a3';   // indigo-800  — accent strip / right panel
const BRAND_LIGHT = '#e0e7ff';   // indigo-100  — filter chips bg
const ACCENT      = '#818cf8';   // indigo-400  — separator line
const GRAY_50     = '#f9fafb';
const GRAY_100    = '#f3f4f6';
const GRAY_200    = '#e5e7eb';
const GRAY_400    = '#9ca3af';
const GRAY_600    = '#4b5563';
const GRAY_800    = '#1f2937';

const MARGIN_BOTTOM = 40;

export function generateListPDF(res, { title, filename, filters = [], columns, rows }) {
  const landscape = columns.length > 5;
  const doc = new PDFDocument({
    size: 'A4',
    layout: landscape ? 'landscape' : 'portrait',
    margins: { top: 40, bottom: MARGIN_BOTTOM, left: 40, right: 40 },
    bufferPages: true,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageW = doc.page.width - 80;

  drawPageContent(doc, { title, filters, columns, rows, pageW });

  // Stamp page numbers on every buffered page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    // fy must be within the printable area (below page.height - MARGIN_BOTTOM triggers auto-pagination)
    const fy = doc.page.height - MARGIN_BOTTOM - 2;
    doc.rect(40, fy - 8, pageW, 0.5).fillColor(GRAY_200).fill();
    doc.fontSize(7).fillColor(GRAY_400).font('Helvetica')
      .text('Feedchem (India) Limited  ·  Confidential', 40, fy, { lineBreak: false });
    doc.fontSize(7).fillColor(GRAY_400).font('Helvetica')
      .text(`Page ${i + 1} of ${range.count}`, 40, fy, { align: 'right', width: pageW, lineBreak: false });
  }

  doc.end();
}

function drawPageContent(doc, { title, filters, columns, rows, pageW }) {
  const HEADER_H   = 78;
  const STRIPE_W   = 6;
  const RIGHT_W    = 170;
  const HEADER_TOP = 22;

  // ── 1. Main header band ───────────────────────────────────────────
  doc.rect(40, HEADER_TOP, pageW, HEADER_H).fillColor(BRAND_DARK).fill();
  doc.rect(40, HEADER_TOP, STRIPE_W, HEADER_H).fillColor(BRAND_MID).fill();
  doc.rect(40 + pageW - RIGHT_W, HEADER_TOP, RIGHT_W, HEADER_H).fillColor(BRAND_MID).fill();
  doc.rect(40 + pageW - RIGHT_W, HEADER_TOP, 1, HEADER_H).fillColor(ACCENT).fill();

  // ── 2. Company initial badge ──────────────────────────────────────
  const BADGE_X = 40 + STRIPE_W + 12;
  const BADGE_Y = HEADER_TOP + 16;
  const BADGE_S = 46;
  doc.roundedRect(BADGE_X, BADGE_Y, BADGE_S, BADGE_S, 8)
    .fillColor('rgba(255,255,255,0.12)').fill();
  doc.fontSize(26).fillColor('white').font('Helvetica-Bold')
    .text('F', BADGE_X, BADGE_Y + 8, { width: BADGE_S, align: 'center' });

  // ── 3. Company name & tagline ─────────────────────────────────────
  const TEXT_X = BADGE_X + BADGE_S + 12;
  const TEXT_W = pageW - (TEXT_X - 40) - RIGHT_W - 10;
  doc.fontSize(17).fillColor('white').font('Helvetica-Bold')
    .text('FEEDCHEM (INDIA) LIMITED', TEXT_X, HEADER_TOP + 20, { width: TEXT_W, lineBreak: false });
  doc.fontSize(9).fillColor('#a5b4fc').font('Helvetica')
    .text('Sales Management System', TEXT_X, HEADER_TOP + 41, { width: TEXT_W });
  const nameW = Math.min(doc.widthOfString('FEEDCHEM (INDIA) LIMITED', { fontSize: 17 }), TEXT_W);
  doc.rect(TEXT_X, HEADER_TOP + 38, nameW, 1).fillColor('rgba(255,255,255,0.25)').fill();

  // ── 4. Right panel ────────────────────────────────────────────────
  const RP_X = 40 + pageW - RIGHT_W + 12;
  const RP_W = RIGHT_W - 20;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

  doc.fontSize(7.5).fillColor('#c7d2fe').font('Helvetica')
    .text('Generated on', RP_X, HEADER_TOP + 14, { width: RP_W });
  doc.fontSize(9.5).fillColor('white').font('Helvetica-Bold')
    .text(dateStr, RP_X, HEADER_TOP + 25, { width: RP_W });
  doc.fontSize(8).fillColor('#a5b4fc').font('Helvetica')
    .text(timeStr + ' IST', RP_X, HEADER_TOP + 39, { width: RP_W });

  const countText = `${rows.length} record${rows.length !== 1 ? 's' : ''}`;
  const pillW = Math.min(doc.widthOfString(countText, { fontSize: 8 }) + 16, RP_W);
  doc.roundedRect(RP_X, HEADER_TOP + 54, pillW, 14, 7)
    .fillColor('rgba(255,255,255,0.15)').fill();
  doc.fontSize(8).fillColor('white').font('Helvetica-Bold')
    .text(countText, RP_X, HEADER_TOP + 57, { width: pillW, align: 'center', lineBreak: false });

  // ── 5. Accent separator ───────────────────────────────────────────
  doc.rect(40, HEADER_TOP + HEADER_H, pageW, 3).fillColor(ACCENT).fill();

  // ── 6. Report title block ─────────────────────────────────────────
  let y = HEADER_TOP + HEADER_H + 3 + 16;

  doc.rect(40, y, 4, 30).fillColor(BRAND).fill();
  doc.fontSize(16).fillColor(BRAND_DARK).font('Helvetica-Bold')
    .text(title, 52, y + 2, { width: pageW - 12, lineBreak: false });
  doc.fontSize(8).fillColor(GRAY_400).font('Helvetica')
    .text('Feedchem (India) Limited  ·  Internal Report', 52, y + 21, { width: pageW - 12 });

  y += 40;
  doc.rect(40, y, pageW, 0.5).fillColor(GRAY_200).fill();
  y += 10;

  // ── 7. Filter chips ───────────────────────────────────────────────
  if (filters.length > 0) {
    doc.fontSize(7.5).fillColor(GRAY_600).font('Helvetica-Bold').text('Active filters:', 40, y);
    y += 13;
    let cx = 40;
    for (const f of filters) {
      const text = `${f.label}: ${f.value}`;
      const tw = Math.min(doc.widthOfString(text) + 18, pageW - (cx - 40));
      if (cx + tw > 40 + pageW) { cx = 40; y += 18; }
      doc.roundedRect(cx, y - 1, tw, 14, 3).fillColor(BRAND_LIGHT).fill();
      doc.fontSize(7.5).fillColor(BRAND).font('Helvetica')
        .text(text, cx + 9, y + 1.5, { width: tw - 12, lineBreak: false });
      cx += tw + 6;
    }
    y += 20;
  }

  y += 8;
  drawTable(doc, { x: 40, y, width: pageW, columns, rows });
}

function drawTable(doc, { x, y, width, columns, rows }) {
  const MIN_ROW_H  = 22;
  const HDR_H      = 26;
  // Leave room for the footer (footer is at page.height - MARGIN_BOTTOM - 2, separator at - 10)
  const PAGE_BOTTOM = doc.page.height - 62;

  const totalFlex = columns.reduce((s, c) => s + (c.flex || 1), 0);
  const cws = columns.map(c => Math.floor(width * (c.flex || 1) / totalFlex));

  // Calculate row height: use min height, or taller if any wrap column needs it
  const calcRowH = (row) => {
    let h = MIN_ROW_H;
    doc.fontSize(8);
    columns.forEach((col, ci) => {
      if (col.wrap) {
        const val = String(row[col.key] ?? '');
        if (val) {
          const textH = doc.heightOfString(val, { width: cws[ci] - 10 });
          h = Math.max(h, textH + 16); // 8px top + 8px bottom padding
        }
      }
    });
    return Math.ceil(h);
  };

  const drawHeader = (atY) => {
    doc.rect(x, atY, width, HDR_H).fillColor(GRAY_100).fill();
    doc.moveTo(x, atY).lineTo(x + width, atY).strokeColor(GRAY_200).lineWidth(0.8).stroke();
    doc.moveTo(x, atY + HDR_H).lineTo(x + width, atY + HDR_H).strokeColor(GRAY_200).lineWidth(0.8).stroke();
    let cx = x;
    columns.forEach((col, i) => {
      doc.fontSize(8.5).fillColor(GRAY_800).font('Helvetica-Bold')
        .text(col.header, cx + 5, atY + (HDR_H - 9) / 2, { width: cws[i] - 8, lineBreak: false });
      cx += cws[i];
    });
    return atY + HDR_H;
  };

  y = drawHeader(y);

  rows.forEach((row, ri) => {
    const rowH = calcRowH(row);

    if (y + rowH > PAGE_BOTTOM) {
      doc.addPage();
      y = 50;
      y = drawHeader(y);
    }

    if (ri % 2 === 1) doc.rect(x, y, width, rowH).fillColor(GRAY_50).fill();
    doc.moveTo(x, y + rowH).lineTo(x + width, y + rowH).strokeColor(GRAY_200).lineWidth(0.3).stroke();

    let cx = x;
    columns.forEach((col, ci) => {
      const val = String(row[col.key] ?? '');
      const cw  = cws[ci];

      if (col.wrap) {
        // Top-aligned wrapping text
        doc.fontSize(8)
          .fillColor(col.bold ? GRAY_800 : GRAY_600)
          .font(col.bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(val || '', cx + 5, y + 8, { width: cw - 10, lineBreak: true });
      } else if (col.badge && val) {
        const badge = col.badge(val);
        if (badge) {
          const bw = Math.min(doc.widthOfString(val) + 16, cw - 8);
          doc.roundedRect(cx + 4, y + (rowH - 14) / 2, bw, 14, 3).fillColor(badge.bg).fill();
          doc.fontSize(7.5).fillColor(badge.fg).font('Helvetica-Bold')
            .text(val, cx + 4, y + (rowH - 9) / 2, { width: bw, align: 'center', lineBreak: false });
        } else {
          doc.fontSize(8).fillColor(GRAY_600).font('Helvetica')
            .text(val, cx + 5, y + (rowH - 9) / 2, { width: cw - 10, lineBreak: false });
        }
      } else {
        doc.fontSize(8)
          .fillColor(col.bold ? GRAY_800 : GRAY_600)
          .font(col.bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(val, cx + 5, y + (rowH - 9) / 2, { width: cw - 10, lineBreak: false });
      }
      cx += cw;
    });

    y += rowH;
  });

  doc.moveTo(x, y).lineTo(x + width, y).strokeColor(GRAY_200).lineWidth(0.8).stroke();
}
