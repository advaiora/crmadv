import type { QuoteStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import type { QuotePdfData } from '../service.js';
import { formatDateTime, formatMoney, formatQty } from './format.js';
import {
  type WorkspacePdfData,
  type BrandPalette,
  buildBrandPalette,
  resolveLogoBuffer,
  toBuffer,
  ensureVerticalSpace,
  mixColors,
} from '../../../core/pdf.js';

type QuotePdfRenderOptions = {
  includeItems?: boolean;
  includeCompanyFooter?: boolean;
  headerTitle?: string;
  footerNote?: string;
  signatureUrl?: string | null;
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
  DRAFT: 'Bozza',
  SENT: 'Inviato',
  ACCEPTED: 'Accettato',
  REJECTED: 'Rifiutato',
  EXPIRED: 'Scaduto',
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

const drawTableHeader = (doc: PDFKit.PDFDocument, columns: TableColumns, palette: BrandPalette) => {
  const headerHeight = 22;
  const y = doc.y;

  doc.save();
  doc
    .rect(columns.tableLeft, y, columns.tableWidth, headerHeight)
    .fillAndStroke(palette.tableHeaderBackground, palette.tableBorderColor);
  doc.restore();

  doc.fillColor(palette.tableHeaderTextColor).font('Helvetica-Bold').fontSize(9);
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
  palette: BrandPalette,
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
    .strokeColor(palette.tableBorderColor)
    .lineWidth(0.6)
    .stroke();
  doc.restore();

  doc.fillColor(palette.secondaryColor).font('Helvetica').fontSize(10);
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
  options: QuotePdfRenderOptions = {},
) => {
  const palette = buildBrandPalette(workspace);
  const logoBuffer = await resolveLogoBuffer(workspace.logoUrl);
  const signatureBuffer = await resolveLogoBuffer(options.signatureUrl ?? null);
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
  const includeItems = options.includeItems ?? true;
  const includeCompanyFooter = options.includeCompanyFooter ?? true;
  const headerTitle = options.headerTitle?.trim() || 'Preventivo';

  const headerStartY = doc.y;
  const logoMaxWidth = 128;
  const logoMaxHeight = 48;
  const titleX = logoBuffer ? doc.page.margins.left + logoMaxWidth + 14 : doc.page.margins.left;

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, doc.page.margins.left, headerStartY, {
        fit: [logoMaxWidth, logoMaxHeight],
      });
    } catch {
      // Ignore logo parsing/render errors and continue with text-only header.
    }
  }

  doc.fillColor(palette.primaryColor).font('Helvetica-Bold').fontSize(24).text(headerTitle, titleX, headerStartY);
  doc.fontSize(10).font('Helvetica').fillColor(palette.mutedColor).text(`ID: ${shortId}`, titleX, headerStartY + 28);
  doc.y = Math.max(doc.y, headerStartY + (logoBuffer ? logoMaxHeight : 42));

  doc.moveTo(doc.page.margins.left, doc.y + 4)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
    .lineWidth(1)
    .strokeColor(mixColors(palette.primaryColor, '#ffffff', 0.38))
    .stroke();
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(12).fillColor(palette.secondaryColor).text(workspace.name);
  if (workspace.supportEmail) {
    doc.font('Helvetica').fontSize(10).fillColor(palette.mutedColor).text(`Email: ${workspace.supportEmail}`);
  }

  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(palette.secondaryColor).text('Cliente');
  doc.font('Helvetica').fontSize(10).fillColor(palette.secondaryColor).text(quote.client.name);
  if (quote.client.email) {
    doc.fillColor(palette.mutedColor).text(`Email: ${quote.client.email}`);
  }
  if (quote.client.phone) {
    doc.fillColor(palette.mutedColor).text(`Telefono: ${quote.client.phone}`);
  }

  const addressParts = [
    quote.client.street,
    [quote.client.zip, quote.client.city].filter(Boolean).join(' '),
    quote.client.province,
    quote.client.country,
  ].filter((part) => part && part.trim().length > 0);

  if (addressParts.length > 0) {
    doc.fillColor(palette.mutedColor).text(`Indirizzo: ${addressParts.join(', ')}`);
  }

  const columns = buildColumns(doc);
  if (includeItems) {
    doc.moveDown(1);
    doc.fillColor(palette.secondaryColor).font('Helvetica-Bold').fontSize(12).text('Righe preventivo');
    doc.moveDown(0.4);

    ensureVerticalSpace(doc, 30, () => {
      drawTableHeader(doc, columns, palette);
    });
    drawTableHeader(doc, columns, palette);

    if (quote.lines.length === 0) {
      ensureVerticalSpace(doc, 30, () => {
        drawTableHeader(doc, columns, palette);
      });
      drawTableRow(doc, columns, palette, {
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
          drawTableHeader(doc, columns, palette);
        });
        drawTableRow(doc, columns, palette, {
          title: line.title,
          qty: formatQty(line.qty),
          unitPrice: formatMoney(line.unitPrice, quote.currency),
          lineTotal: formatMoney(line.lineTotal, quote.currency),
        });
      }
    }
  }

  doc.moveDown(1);
  ensureVerticalSpace(doc, 110);

  const summaryRightX = columns.unitPrice.x + 5;
  const summaryRightWidth = columns.unitPrice.width + columns.lineTotal.width - 10;
  const summaryStartY = doc.y;
  const summarySubtotalLabelY = summaryStartY;
  const summarySubtotalValueY = summaryStartY + 14;
  const summaryTaxLabelY = summaryStartY + 30;
  const summaryTaxValueY = summaryStartY + 44;
  const summaryTotalLabelY = summaryStartY + 62;
  const summaryTotalValueY = summaryStartY + 80;

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(palette.secondaryColor)
    .text('Subtotale', summaryRightX, summarySubtotalLabelY, {
      width: summaryRightWidth,
      align: 'right',
    });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(palette.secondaryColor)
    .text(formatMoney(quote.subtotal, quote.currency), summaryRightX, summarySubtotalValueY, {
      width: summaryRightWidth,
      align: 'right',
    });

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(palette.secondaryColor)
    .text('IVA', summaryRightX, summaryTaxLabelY, {
      width: summaryRightWidth,
      align: 'right',
    });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(palette.secondaryColor)
    .text(formatMoney(quote.taxTotal, quote.currency), summaryRightX, summaryTaxValueY, {
      width: summaryRightWidth,
      align: 'right',
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(palette.secondaryColor)
    .text('Totale', summaryRightX, summaryTotalLabelY, {
      width: summaryRightWidth,
      align: 'right',
    });
  doc
    .fillColor(palette.primaryColor)
    .fontSize(18)
    .text(formatMoney(quote.total, quote.currency), summaryRightX, summaryTotalValueY, {
      width: summaryRightWidth,
      align: 'right',
    });
  doc.y = summaryStartY + 106;

  if (quote.notes) {
    doc.moveDown(1.6);
    ensureVerticalSpace(doc, 80);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(palette.secondaryColor).text('Note');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor(palette.mutedColor).text(quote.notes, {
      width: columns.tableWidth,
    });
  }

  doc.moveDown(1.2);
  ensureVerticalSpace(doc, 120);
  doc.font('Helvetica').fontSize(9).fillColor(palette.mutedColor);
  if (quote.issueDate) {
    doc.text(`Emissione: ${formatDateTime(quote.issueDate)}`);
  }
  if (quote.validUntil) {
    doc.text(`Preventivo valido fino a: ${formatDateTime(quote.validUntil)}`);
  }
  doc.text(`Stato: ${STATUS_LABELS[quote.status]} (${quote.status})`);
  doc.text(`Creato: ${formatDateTime(quote.createdAt)} | Aggiornato: ${formatDateTime(quote.updatedAt)}`);

  if (options.footerNote?.trim()) {
    doc.moveDown(0.5);
    doc.text(options.footerNote.trim());
  }

  if (includeCompanyFooter) {
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fillColor(palette.secondaryColor).text(workspace.name);
    doc.font('Helvetica').fillColor(palette.mutedColor);
    if (workspace.supportAddress) {
      doc.text(workspace.supportAddress);
    }
    if (workspace.supportPhone) {
      doc.text(`Tel: ${workspace.supportPhone}`);
    }
    if (workspace.supportEmail) {
      doc.text(`Email: ${workspace.supportEmail}`);
    }
    if (!workspace.supportAddress && !workspace.supportPhone && !workspace.supportEmail) {
      // TODO: show richer company contacts when workspace settings include legal/billing fields.
      doc.text('Contatti aziendali non configurati.');
    }
  }

  if (signatureBuffer) {
    try {
      const signatureWidth = 120;
      const signatureHeight = 44;
      ensureVerticalSpace(doc, signatureHeight + 8);
      doc.moveDown(0.5);
      doc.image(signatureBuffer, doc.page.width - doc.page.margins.right - signatureWidth, doc.y, {
        fit: [signatureWidth, signatureHeight],
        align: 'right',
      });
      doc.moveDown(2.6);
    } catch {
      // Ignore signature parsing/render failures to keep export resilient.
    }
  }

  doc.end();
  return bufferPromise;
};
