import PDFDocument from 'pdfkit';

const BRAND = '#4338ca';
const BRAND_DARK = '#312e81';
const BRAND_LIGHT = '#e0e7ff';
const GRAY_50 = '#f9fafb';
const GRAY_100 = '#f3f4f6';
const GRAY_200 = '#e5e7eb';
const GRAY_400 = '#9ca3af';
const GRAY_600 = '#4b5563';
const GRAY_800 = '#1f2937';

export function generateListPDF(res, { title, filename, filters = [], columns, rows }) {
  const landscape = columns.length > 5;
  const doc = new PDFDocument({
    size: 'A4',
    layout: landscape ? 'landscape' : 'portrait',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    bufferPages: true,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageW = doc.page.width - 80;

  // Draw first page content
  drawPageContent(doc, { title, filters, columns, rows, pageW });

  // Add page numbers after all pages are created
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const fy = doc.page.height - 28;
    doc.moveTo(40, fy - 5).lineTo(40 + pageW, fy - 5).strokeColor(GRAY_200).lineWidth(0.5).stroke();
    doc.fontSize(7).fillColor(GRAY_400).font('Helvetica')
      .text(`Feedchem (India) Limited  ·  Confidential  ·  Page ${i + 1} of ${range.count}`,
        40, fy, { align: 'center', width: pageW });
  }

  doc.end();
}

function drawPageContent(doc, { title, filters, columns, rows, pageW }) {
  // Header band
  doc.rect(40, 30, pageW, 54).fillColor(BRAND).fill();
  doc.fontSize(17).fillColor('white').font('Helvetica-Bold')
    .text('Feedchem (India) Limited', 52, 38, { width: pageW - 24 });
  doc.fontSize(10).fillColor('#c7d2fe').font('Helvetica')
    .text(title, 52, 58, { width: pageW - 24 });

  let y = 100;

  // Meta line
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
  doc.fontSize(8).fillColor(GRAY_400).font('Helvetica')
    .text(`Generated: ${now} IST   ·   ${rows.length} record${rows.length !== 1 ? 's' : ''}`, 40, y);
  y += 16;

  // Filter chips
  if (filters.length > 0) {
    doc.fontSize(8).fillColor(GRAY_600).font('Helvetica-Bold').text('Active filters:', 40, y);
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
    y += 22;
  }

  y += 6;
  drawTable(doc, { x: 40, y, width: pageW, columns, rows });
}

function drawTable(doc, { x, y, width, columns, rows }) {
  const ROW_H = 22;
  const HDR_H = 26;
  const PAGE_BOTTOM = doc.page.height - 48;

  // Calculate column widths proportionally
  const totalFlex = columns.reduce((s, c) => s + (c.flex || 1), 0);
  const cws = columns.map(c => Math.floor(width * (c.flex || 1) / totalFlex));

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
    if (y + ROW_H > PAGE_BOTTOM) {
      doc.addPage();
      y = 50;
      y = drawHeader(y);
    }

    if (ri % 2 === 1) doc.rect(x, y, width, ROW_H).fillColor(GRAY_50).fill();
    doc.moveTo(x, y + ROW_H).lineTo(x + width, y + ROW_H).strokeColor(GRAY_200).lineWidth(0.3).stroke();

    let cx = x;
    columns.forEach((col, ci) => {
      const val = String(row[col.key] ?? '');
      const cw = cws[ci];

      if (col.badge && val) {
        const badge = col.badge(val);
        if (badge) {
          const bw = Math.min(doc.widthOfString(val) + 16, cw - 8);
          doc.roundedRect(cx + 4, y + (ROW_H - 14) / 2, bw, 14, 3).fillColor(badge.bg).fill();
          doc.fontSize(7.5).fillColor(badge.fg).font('Helvetica-Bold')
            .text(val, cx + 4, y + (ROW_H - 9) / 2, { width: bw, align: 'center', lineBreak: false });
        } else {
          doc.fontSize(8).fillColor(GRAY_600).font('Helvetica')
            .text(val, cx + 5, y + (ROW_H - 9) / 2, { width: cw - 10, lineBreak: false });
        }
      } else {
        doc.fontSize(8)
          .fillColor(col.bold ? GRAY_800 : GRAY_600)
          .font(col.bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(val, cx + 5, y + (ROW_H - 9) / 2, { width: cw - 10, lineBreak: false });
      }
      cx += cw;
    });

    y += ROW_H;
  });

  doc.moveTo(x, y).lineTo(x + width, y).strokeColor(GRAY_200).lineWidth(0.8).stroke();
}
