// Render del Report cliente Agency in un PDF brandizzato (V6), stile "Apple" a
// sottrazione: gerarchia tipografica netta, un solo accento (colore brand primario),
// spazio ampio, hairline al posto di scatole. Usa gli helper condivisi di core/pdf.ts
// (palette, logo con anti-SSRF, buffer, salto pagina), gli stessi del PDF preventivi.

import PDFDocument from 'pdfkit';
import {
  type WorkspacePdfData,
  buildBrandPalette,
  resolveLogoBuffer,
  toBuffer,
  ensureVerticalSpace,
  mixColors,
} from '../../../core/pdf.js';
import type { AgencyClientReportOutput } from './client-report-engine.js';

export type ClientReportPdfData = {
  projectName: string;
  projectTypeLabel: string;
  clientName: string | null;
  generatedAt: string | null;
  report: AgencyClientReportOutput;
};

const formatItalianDate = (iso: string | null): string | null => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  // Data leggibile it-IT senza dipendere dal locale del server.
  const months = [
    'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
  ];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

export const renderClientReportPdf = async (
  data: ClientReportPdfData,
  workspace: WorkspacePdfData,
): Promise<Buffer> => {
  const palette = buildBrandPalette(workspace);
  const logoBuffer = await resolveLogoBuffer(workspace.logoUrl);
  const hairline = mixColors(palette.secondaryColor, '#ffffff', 0.82);
  const accentSoft = mixColors(palette.primaryColor, '#ffffff', 0.9);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 54,
    info: {
      Title: `Report cliente - ${data.projectName}`,
      Author: workspace.name,
      Subject: 'Client report',
    },
  });
  const bufferPromise = toBuffer(doc);

  const left = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const right = left + contentWidth;

  const drawHairline = () => {
    doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(0.8).strokeColor(hairline).stroke();
  };

  // --- Intestazione: brand in alto (piccolo), poi titolo grande ---------------
  const headerTop = doc.y;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, left, headerTop, { fit: [120, 40] });
    } catch {
      // logo non renderizzabile: si prosegue col solo testo.
    }
  }
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(palette.mutedColor)
    .text(workspace.name.toUpperCase(), logoBuffer ? left + 132 : left, headerTop + (logoBuffer ? 12 : 0), {
      width: logoBuffer ? contentWidth - 132 : contentWidth,
      align: logoBuffer ? 'right' : 'left',
      characterSpacing: 0.6,
    });

  doc.y = headerTop + (logoBuffer ? 48 : 26);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(26).fillColor(palette.secondaryColor).text('Report cliente', left, doc.y);
  doc.moveDown(0.15);
  doc.font('Helvetica').fontSize(15).fillColor(palette.primaryColor).text(data.projectName, { width: contentWidth });

  // Riga meta (tipo progetto, cliente, data) in muted.
  const metaParts = [
    data.projectTypeLabel ? `Tipo: ${data.projectTypeLabel}` : null,
    data.clientName ? `Cliente: ${data.clientName}` : null,
    formatItalianDate(data.generatedAt) ? `Aggiornato al ${formatItalianDate(data.generatedAt)}` : null,
  ].filter(Boolean);
  if (metaParts.length > 0) {
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(9.5).fillColor(palette.mutedColor).text(metaParts.join('   ·   '), { width: contentWidth });
  }

  doc.moveDown(0.9);
  drawHairline();
  doc.moveDown(1);

  // --- Blocchi -----------------------------------------------------------------
  const paragraph = (title: string, body: string) => {
    if (!body.trim()) {
      return;
    }
    const estimate = 26 + doc.heightOfString(body, { width: contentWidth });
    ensureVerticalSpace(doc, Math.min(estimate, 220));
    doc.font('Helvetica-Bold').fontSize(12.5).fillColor(palette.secondaryColor).text(title, left, doc.y);
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(10.5).fillColor(palette.secondaryColor).text(body, { width: contentWidth, lineGap: 2.5 });
    doc.moveDown(1.1);
  };

  const bulletList = (title: string, items: string[]) => {
    ensureVerticalSpace(doc, 48);
    doc.font('Helvetica-Bold').fontSize(12.5).fillColor(palette.secondaryColor).text(title, left, doc.y);
    doc.moveDown(0.4);

    if (items.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(palette.mutedColor).text('Nessun elemento disponibile.', { width: contentWidth });
      doc.moveDown(1.1);
      return;
    }

    const bulletX = left + 2;
    const textX = left + 16;
    const textWidth = contentWidth - 16;
    for (const item of items) {
      const rowHeight = doc.heightOfString(item, { width: textWidth, lineGap: 2 }) + 7;
      ensureVerticalSpace(doc, rowHeight + 2);
      const rowY = doc.y;
      // pallino accento
      doc.circle(bulletX + 2, rowY + 6, 2).fill(palette.primaryColor);
      doc.font('Helvetica').fontSize(10.5).fillColor(palette.secondaryColor).text(item, textX, rowY, { width: textWidth, lineGap: 2 });
      doc.y = rowY + rowHeight;
    }
    doc.moveDown(0.9);
  };

  paragraph('Executive summary', data.report.executiveSummary);
  paragraph('Stato del progetto', data.report.projectStatusSummary);
  bulletList('Attività impostate', data.report.workCompletedSummary);
  bulletList('Elementi da presidiare', data.report.keyFindings);
  bulletList('Opportunità di miglioramento', data.report.keyOpportunities);
  bulletList('Prossimi passi', data.report.nextStepsSummary);

  // --- Footer brandizzato ------------------------------------------------------
  ensureVerticalSpace(doc, 96);
  doc.moveDown(0.4);
  // fascia soft d'accento come separatore del footer
  doc.rect(left, doc.y, contentWidth, 3).fill(accentSoft);
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(palette.secondaryColor).text(workspace.name, left, doc.y, { width: contentWidth });
  const contactParts = [
    workspace.supportEmail ? `Email: ${workspace.supportEmail}` : null,
    workspace.supportPhone ? `Tel: ${workspace.supportPhone}` : null,
    workspace.supportAddress || null,
  ].filter(Boolean);
  if (contactParts.length > 0) {
    doc.font('Helvetica').fontSize(9).fillColor(palette.mutedColor).text(contactParts.join('   ·   '), { width: contentWidth });
  }
  const generatedLabel = formatItalianDate(data.generatedAt);
  doc.font('Helvetica').fontSize(8.5).fillColor(palette.mutedColor).text(
    `Report generato dal workspace Agency AI OS${generatedLabel ? ` · ${generatedLabel}` : ''}.`,
    { width: contentWidth },
  );

  doc.end();
  return bufferPromise;
};
