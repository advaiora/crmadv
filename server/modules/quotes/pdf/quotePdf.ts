import type { QuoteStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import type { QuotePdfData } from '../../../services/workspace-quotes.service.js';
import { formatDateTime, formatMoney, formatQty } from './format.js';

type WorkspacePdfData = {
  name: string;
  supportEmail: string | null;
};

type TableColumn = {
  x: number;
  width: number;
};

type TableColumns = {
  title: TableColumn;
  qty: TableColumn;
  unitPrice: TableColumn;
  lineTotal: TableColumn;
  tableLeft: number;
  tableWidth: number;
};

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Bozza',
  sent: 'Inviato',
  accepted: 'Accettato',
};

const toBuffer = (doc: PDFKit.PDFDocument) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

const ensureVerticalSpace = (
  doc: PDFKit.PDFDocument,
  requiredHeight: number,
  onPageBreak?: () => void,
) => {
  const availableBottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + requiredHeight <= availableBottom) {
    return;
  }

  doc.addPage();
  if (onPageBreak) {
    onPageBreak();
  }
};

const buildColumns = (doc: PDFKit.PDFDocument): TableColumns => {
  const tableLeft = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const titleWidth = tableWidth * 0.48;
  const qtyWidth = tableWidth * 0.12;
  const unitPriceWidth = tableWidth * 0.2;
  const lineTotalWidth = tableWidth - titleWidth - qtyWidth - unitPriceWidth;

  return {
    tableLeft,
    tableWidth,
    title: { x: tableLeft, width: titleWidth },
    qty: { x: tableLeft + titleWidth, width: qtyWidth },
    unitPrice: { x: tableLeft + titleWidth + qtyWidth, width: unitPriceWidth },
    lineTotal: { x: tableLeft + titleWidth + qtyWidth + unitPriceWidth, width: lineTotalWidth },
  };
};

const drawTableHeader = (doc: PDFKit.PDFDocument, columns: TableColumns) => {
  const headerHeight = 22;
  const y = doc.y;

  doc.save();
  doc
    .rect(columns.tableLeft, y, columns.tableWidth, headerHeight)
    .fillAndStroke('#f3f4f6', '#d1d5db');
  doc.restore();

  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9);
  doc.text('Title', columns.title.x + 5, y + 7, { width: columns.title.width - 10 });
  doc.text('Qty', columns.qty.x + 5, y + 7, {
    width: columns.qty.width - 10,
    align: 'right',
  });
  doc.text('Unit Price', columns.unitPrice.x + 5, y + 7, {
    width: columns.unitPrice.width - 10,
    align: 'right',
  });
  doc.text('Line Total', columns.lineTotal.x + 5, y + 7, {
    width: columns.lineTotal.width - 10,
    align: 'right',
  });

  doc.y = y + headerHeight;
};

const drawTableRow = (
  doc: PDFKit.PDFDocument,
  columns: TableColumns,
  line: {
    title: string;
    qty: string;
    unitPrice: string;
    lineTotal: string;
  },
) => {
  const paddingY = 6;
  const titleHeight = doc.heightOfString(line.title, {
    width: columns.title.width - 10,
  });
  const rowHeight = Math.max(22, titleHeight + paddingY * 2);
  const y = doc.y;

  doc.save();
  doc
    .rect(columns.tableLeft, y, columns.tableWidth, rowHeight)
    .strokeColor('#e5e7eb')
    .lineWidth(0.6)
    .stroke();
  doc.restore();

  doc.fillColor('#111827').font('Helvetica').fontSize(10);
  doc.text(line.title, columns.title.x + 5, y + paddingY, { width: columns.title.width - 10 });
  doc.text(line.qty, columns.qty.x + 5, y + paddingY, {
    width: columns.qty.width - 10,
    align: 'right',
  });
  doc.text(line.unitPrice, columns.unitPrice.x + 5, y + paddingY, {
    width: columns.unitPrice.width - 10,
    align: 'right',
  });
  doc.text(line.lineTotal, columns.lineTotal.x + 5, y + paddingY, {
    width: columns.lineTotal.width - 10,
    align: 'right',
  });

  doc.y = y + rowHeight;
};

export const renderQuotePdf = async (
  quote: QuotePdfData,
  workspace: WorkspacePdfData,
) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Preventivo ${quote.id}`,
      Author: workspace.name,
      Subject: 'Quote export',
    },
  });

  const bufferPromise = toBuffer(doc);
  const shortId = quote.id.slice(0, 8).toUpperCase();

  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(24).text('Preventivo');
  doc.fontSize(10).font('Helvetica').fillColor('#4b5563').text(`ID: ${shortId}`);
  doc.moveDown(0.6);

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(workspace.name);
  if (workspace.supportEmail) {
    doc.font('Helvetica').fontSize(10).fillColor('#4b5563').text(`Email: ${workspace.supportEmail}`);
  }

  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Cliente');
  doc.font('Helvetica').fontSize(10).fillColor('#111827').text(quote.client.name);
  if (quote.client.email) {
    doc.fillColor('#4b5563').text(`Email: ${quote.client.email}`);
  }
  if (quote.client.phone) {
    doc.fillColor('#4b5563').text(`Telefono: ${quote.client.phone}`);
  }

  doc.moveDown(1);
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12).text('Righe preventivo');
  doc.moveDown(0.4);

  const columns = buildColumns(doc);
  ensureVerticalSpace(doc, 30, () => {
    drawTableHeader(doc, columns);
  });
  drawTableHeader(doc, columns);

  if (quote.lines.length === 0) {
    ensureVerticalSpace(doc, 30, () => {
      drawTableHeader(doc, columns);
    });
    drawTableRow(doc, columns, {
      title: 'Nessuna riga presente',
      qty: '-',
      unitPrice: '-',
      lineTotal: '-',
    });
  } else {
    for (const line of quote.lines) {
      const titleHeight = doc.heightOfString(line.title, {
        width: columns.title.width - 10,
      });
      const rowHeight = Math.max(22, titleHeight + 12);

      ensureVerticalSpace(doc, rowHeight + 4, () => {
        drawTableHeader(doc, columns);
      });
      drawTableRow(doc, columns, {
        title: line.title,
        qty: formatQty(line.qty),
        unitPrice: formatMoney(line.unitPrice),
        lineTotal: formatMoney(line.lineTotal),
      });
    }
  }

  doc.moveDown(1);
  ensureVerticalSpace(doc, 60);

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111827')
    .text('Totale', columns.unitPrice.x + 5, doc.y, {
      width: columns.unitPrice.width + columns.lineTotal.width - 10,
      align: 'right',
    });
  doc
    .fontSize(18)
    .text(formatMoney(quote.total), columns.unitPrice.x + 5, doc.y + 4, {
      width: columns.unitPrice.width + columns.lineTotal.width - 10,
      align: 'right',
    });

  if (quote.notes) {
    doc.moveDown(1.6);
    ensureVerticalSpace(doc, 80);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Note');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor('#374151').text(quote.notes, {
      width: columns.tableWidth,
    });
  }

  doc.moveDown(1.2);
  ensureVerticalSpace(doc, 45);
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
  doc.text(`Stato: ${STATUS_LABELS[quote.status]} (${quote.status})`);
  doc.text(`Creato: ${formatDateTime(quote.createdAt)} | Aggiornato: ${formatDateTime(quote.updatedAt)}`);

  doc.end();
  return bufferPromise;
};
