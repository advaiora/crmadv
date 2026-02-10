type DecimalLike = {
  toFixed: (digits?: number) => string;
};

type QuoteTemplateInput = {
  id: string;
  status: string;
  total: DecimalLike | string | number;
  notes: string | null;
  client: {
    name: string;
  };
};

type WorkspaceTemplateInput = {
  name: string;
};

type BuildQuoteEmailInput = {
  quote: QuoteTemplateInput;
  workspace: WorkspaceTemplateInput;
  to: string;
  subject?: string | null;
  message?: string | null;
};

const EURO_FORMATTER = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const resolveMoneyNumber = (value: DecimalLike | string | number) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value.toFixed(2));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: DecimalLike | string | number) =>
  EURO_FORMATTER.format(resolveMoneyNumber(value));

const buildSubject = (
  quoteId: string,
  workspaceName: string,
  customSubject?: string | null,
) => {
  if (customSubject?.trim()) {
    return customSubject.trim();
  }

  const shortId = quoteId.slice(0, 8).toUpperCase();
  return `Preventivo ${shortId} - ${workspaceName}`;
};

export const buildQuoteEmail = (input: BuildQuoteEmailInput) => {
  const subject = buildSubject(input.quote.id, input.workspace.name, input.subject);
  const totalLabel = formatMoney(input.quote.total);
  const customMessage = input.message?.trim() || '';
  const safeWorkspace = escapeHtml(input.workspace.name);
  const safeQuoteId = escapeHtml(input.quote.id);
  const safeStatus = escapeHtml(input.quote.status);
  const safeClientName = escapeHtml(input.quote.client.name);
  const safeMessage = customMessage ? escapeHtml(customMessage) : '';
  const safeNote = input.quote.notes ? escapeHtml(input.quote.notes) : '';

  const textParts = [
    `Ciao,`,
    customMessage || 'In allegato trovi il preventivo richiesto.',
    '',
    `Workspace: ${input.workspace.name}`,
    `Preventivo: ${input.quote.id}`,
    `Stato: ${input.quote.status}`,
    `Totale: ${totalLabel}`,
    'Allegato: PDF preventivo.',
  ];

  if (input.quote.notes?.trim()) {
    textParts.push(`Note: ${input.quote.notes.trim()}`);
  }

  const text = textParts.join('\n');

  const html = `
<!doctype html>
<html lang="it">
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
            <tr>
              <td style="padding:24px 24px 8px;">
                <h1 style="margin:0 0 8px;font-size:20px;">${safeWorkspace}</h1>
                <p style="margin:0;font-size:14px;color:#4b5563;">Invio preventivo con allegato PDF</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 0;">
                <p style="margin:0 0 12px;font-size:14px;">Ciao,</p>
                <p style="margin:0 0 16px;font-size:14px;">${safeMessage || 'In allegato trovi il preventivo richiesto.'}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;"><strong>Preventivo</strong></td><td style="padding:8px 0;border-top:1px solid #e5e7eb;" align="right">${safeQuoteId}</td></tr>
                  <tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;"><strong>Cliente</strong></td><td style="padding:8px 0;border-top:1px solid #e5e7eb;" align="right">${safeClientName}</td></tr>
                  <tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;"><strong>Stato</strong></td><td style="padding:8px 0;border-top:1px solid #e5e7eb;" align="right">${safeStatus}</td></tr>
                  <tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;"><strong>Totale</strong></td><td style="padding:8px 0;border-top:1px solid #e5e7eb;" align="right">${escapeHtml(totalLabel)}</td></tr>
                </table>
              </td>
            </tr>
            ${
              safeNote
                ? `<tr><td style="padding:12px 24px 0;"><p style="margin:0;font-size:13px;color:#374151;"><strong>Note:</strong> ${safeNote}</p></td></tr>`
                : ''
            }
            <tr>
              <td style="padding:18px 24px 24px;">
                <p style="margin:0;font-size:12px;color:#6b7280;">Trovi il PDF del preventivo in allegato.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();

  return {
    subject,
    text,
    html,
  };
};

