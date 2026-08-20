import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), filename);
}

export function exportExcel(filename, rows, sheetName = 'Report') {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function exportPdf(filename, title, columns, rows) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [columns],
    body: rows,
    styles: { fontSize: 8 },
  });
  doc.save(filename);
}

// The report-photos bucket is private (signed URLs only, see
// reports.js#getReportPhotoSignedUrl), and jsPDF's addImage needs actual
// image bytes rather than a URL it can't itself fetch cross-origin — so
// every photo going into a PDF has to be converted to a data: URL first.
export async function urlToDataUrl(url) {
  if (!url) return null;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// One report per block: header line, address/status line, then before/after
// photo thumbnails side by side where available. `reports` items:
// { reportNumber, issueType, uc, address, status, resolvedBy, resolvedAt,
//   beforeDataUrl, afterDataUrl }.
export function exportReportsPdf(filename, title, reports) {
  const doc = new jsPDF();
  const marginX = 14;
  const pageBottom = 270;
  const imgW = 45;
  const imgH = 34;
  let y = 22;

  doc.setFontSize(14);
  doc.text(title, marginX, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`${reports.length} report${reports.length === 1 ? '' : 's'}`, marginX, 20);
  doc.setTextColor(0);

  for (const r of reports) {
    const blockHeight = 15 + (r.beforeDataUrl || r.afterDataUrl ? imgH + 8 : 0);
    if (y + blockHeight > pageBottom) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(`${r.reportNumber || ''} — ${r.issueType || ''} — ${r.uc || ''}`, marginX, y);
    doc.setFont(undefined, 'normal');
    y += 5;

    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(r.address || '—', marginX, y);
    y += 4;
    const statusLine = `Status: ${r.status || ''}${r.resolvedBy ? `  ·  Resolved by ${r.resolvedBy}` : ''}${r.resolvedAt ? `  ·  ${r.resolvedAt}` : ''}`;
    doc.text(statusLine, marginX, y);
    doc.setTextColor(0);
    y += 4;

    if (r.beforeDataUrl || r.afterDataUrl) {
      let x = marginX;
      if (r.beforeDataUrl) {
        try {
          doc.addImage(r.beforeDataUrl, 'JPEG', x, y, imgW, imgH);
        } catch {
          // A photo that fails to decode just gets skipped, not a broken PDF.
        }
        doc.setFontSize(7);
        doc.text('Before', x, y + imgH + 3);
        x += imgW + 6;
      }
      if (r.afterDataUrl) {
        try {
          doc.addImage(r.afterDataUrl, 'JPEG', x, y, imgW, imgH);
        } catch {
          // ignore
        }
        doc.setFontSize(7);
        doc.text('After', x, y + imgH + 3);
      }
      doc.setFontSize(8);
      y += imgH + 8;
    } else {
      y += 4;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, y, 196, y);
    y += 6;
  }

  doc.save(filename);
}
