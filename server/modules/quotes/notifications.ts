import { resolveMailTransportDettagliato, type EsitoCanaleDiPosta } from '../../core/mail.js';
import { brandingRepository } from '../../repositories/branding.repository.js';
import { quotesRepository } from './repository.js';
import { renderQuotePdf } from './pdf/quotePdf.js';
import type { QuotePdfData } from './service.js';

type QuoteNotificationTemplate = {
  subject: string;
  body: string;
};

type ResolvedQuoteNotificationTemplates = {
  enabled: boolean;
  SENT: QuoteNotificationTemplate;
  ACCEPTED: QuoteNotificationTemplate;
  REJECTED: QuoteNotificationTemplate;
};

type QuoteNotificationQuote = {
  id: string;
  status: string;
  currency: string;
  total: number;
  client: {
    name: string;
    email: string | null;
  };
};

type NotifyQuoteEventInput = {
  workspaceId: string;
  event: QuoteNotificationEvent;
  quote: QuoteNotificationQuote;
  quotePdfData?: QuotePdfData;
};

type NotifyQuoteEventResult = {
  delivered: boolean;
  skippedReason?: string;
  providerMessageId?: string | null;
};

type QuoteNotificationTemplatePayload = {
  enabled?: boolean;
  sentSubject?: string | null;
  sentBody?: string | null;
  acceptedSubject?: string | null;
  acceptedBody?: string | null;
  rejectedSubject?: string | null;
  rejectedBody?: string | null;
};

type QuoteNotificationsDependencies = {
  getNotificationSettings: typeof quotesRepository.getNotificationSettings;
  upsertNotificationSettings: typeof quotesRepository.upsertNotificationSettings;
  findBrandingByWorkspaceId: typeof brandingRepository.findByWorkspaceId;
  renderQuotePdfFn: typeof renderQuotePdf;
  resolveTransport: (workspaceId: string) => Promise<EsitoCanaleDiPosta>;
};

type NotificationEventMetrics = {
  attempted: number;
  delivered: number;
  skipped: number;
  failed: number;
  bySkipReason: Record<string, number>;
  lastUpdatedAt: string | null;
  lastError: string | null;
};

type WorkspaceNotificationsMetrics = {
  SENT: NotificationEventMetrics;
  ACCEPTED: NotificationEventMetrics;
  REJECTED: NotificationEventMetrics;
};

export type QuoteNotificationEvent = 'SENT' | 'ACCEPTED' | 'REJECTED';

export const DEFAULT_QUOTE_NOTIFICATION_TEMPLATES: ResolvedQuoteNotificationTemplates = {
  enabled: true,
  SENT: {
    subject: 'Il tuo preventivo {numero} e stato inviato',
    body: 'Gentile {cliente}, il tuo preventivo {numero} e stato inviato e puo essere visionato nel tuo account.',
  },
  ACCEPTED: {
    subject: 'Il tuo preventivo {numero} e stato accettato',
    body: 'Gentile {cliente}, il preventivo {numero} e stato accettato. Grazie per aver scelto i nostri servizi.',
  },
  REJECTED: {
    subject: 'Il tuo preventivo {numero} e stato rifiutato',
    body: 'Gentile {cliente}, il preventivo {numero} e stato rifiutato. Se desideri, possiamo aggiornarlo insieme.',
  },
};

const quoteNotificationsMetricsState = new Map<string, WorkspaceNotificationsMetrics>();

const eventFieldMap = {
  SENT: {
    subject: 'sentSubject',
    body: 'sentBody',
  },
  ACCEPTED: {
    subject: 'acceptedSubject',
    body: 'acceptedBody',
  },
  REJECTED: {
    subject: 'rejectedSubject',
    body: 'rejectedBody',
  },
} as const;

const normalizeTemplateText = (value: string | null | undefined, fallback: string) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
};

export const renderQuoteNotificationTemplate = (
  template: string,
  payload: {
    clientName: string;
    quoteNumber: string;
    workspaceName: string;
    status: string;
    total: string;
  },
) =>
  template
    .replaceAll('{cliente}', payload.clientName)
    .replaceAll('{numero}', payload.quoteNumber)
    .replaceAll('{workspace}', payload.workspaceName)
    .replaceAll('{stato}', payload.status)
    .replaceAll('{totale}', payload.total);

const formatMoney = (value: number, currency: string) => {
  const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'EUR';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: safeCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const resolveWorkspaceTemplates = async (
  dependencies: QuoteNotificationsDependencies,
  workspaceId: string,
): Promise<ResolvedQuoteNotificationTemplates> => {
  const settings = await dependencies.getNotificationSettings(workspaceId);
  if (!settings) {
    return DEFAULT_QUOTE_NOTIFICATION_TEMPLATES;
  }

  return {
    enabled: settings.enabled,
    SENT: {
      subject: normalizeTemplateText(
        settings.sentSubject,
        DEFAULT_QUOTE_NOTIFICATION_TEMPLATES.SENT.subject,
      ),
      body: normalizeTemplateText(
        settings.sentBody,
        DEFAULT_QUOTE_NOTIFICATION_TEMPLATES.SENT.body,
      ),
    },
    ACCEPTED: {
      subject: normalizeTemplateText(
        settings.acceptedSubject,
        DEFAULT_QUOTE_NOTIFICATION_TEMPLATES.ACCEPTED.subject,
      ),
      body: normalizeTemplateText(
        settings.acceptedBody,
        DEFAULT_QUOTE_NOTIFICATION_TEMPLATES.ACCEPTED.body,
      ),
    },
    REJECTED: {
      subject: normalizeTemplateText(
        settings.rejectedSubject,
        DEFAULT_QUOTE_NOTIFICATION_TEMPLATES.REJECTED.subject,
      ),
      body: normalizeTemplateText(
        settings.rejectedBody,
        DEFAULT_QUOTE_NOTIFICATION_TEMPLATES.REJECTED.body,
      ),
    },
  };
};

const buildPdfAttachment = async (
  dependencies: QuoteNotificationsDependencies,
  workspaceName: string,
  workspaceId: string,
  quotePdfData: QuotePdfData,
  branding: Awaited<ReturnType<typeof brandingRepository.findByWorkspaceId>>,
) => {
  const pdfBuffer = await dependencies.renderQuotePdfFn(quotePdfData, {
    name: branding?.workspaceName?.trim() || workspaceName,
    supportEmail: branding?.supportEmail ?? null,
    logoUrl: branding?.logoUrl ?? null,
    primaryColor: branding?.primaryColor ?? null,
    secondaryColor: branding?.secondaryColor ?? null,
    supportPhone: branding?.supportPhone ?? null,
    supportAddress: branding?.supportAddress ?? null,
  }, {
    signatureUrl: branding?.pdfSignatureUrl ?? null,
    includeItems: true,
    includeCompanyFooter: true,
  });

  return {
    filename: `quote_${quotePdfData.id.slice(0, 8)}.pdf`,
    content: pdfBuffer,
    contentType: 'application/pdf',
  };
};

const createEventMetrics = (): NotificationEventMetrics => ({
  attempted: 0,
  delivered: 0,
  skipped: 0,
  failed: 0,
  bySkipReason: {},
  lastUpdatedAt: null,
  lastError: null,
});

const createWorkspaceNotificationsMetrics = (): WorkspaceNotificationsMetrics => ({
  SENT: createEventMetrics(),
  ACCEPTED: createEventMetrics(),
  REJECTED: createEventMetrics(),
});

const getOrCreateWorkspaceMetrics = (workspaceId: string) => {
  const existing = quoteNotificationsMetricsState.get(workspaceId);
  if (existing) {
    return existing;
  }

  const created = createWorkspaceNotificationsMetrics();
  quoteNotificationsMetricsState.set(workspaceId, created);
  return created;
};

const updateMetricsForResult = (
  workspaceId: string,
  event: QuoteNotificationEvent,
  result: NotifyQuoteEventResult,
) => {
  const state = getOrCreateWorkspaceMetrics(workspaceId);
  const bucket = state[event];
  bucket.attempted += 1;
  bucket.lastUpdatedAt = new Date().toISOString();
  if (result.delivered) {
    bucket.delivered += 1;
    return;
  }

  bucket.skipped += 1;
  if (result.skippedReason) {
    bucket.bySkipReason[result.skippedReason] = (bucket.bySkipReason[result.skippedReason] ?? 0) + 1;
  }
};

const updateMetricsForError = (workspaceId: string, event: QuoteNotificationEvent, error: unknown) => {
  const state = getOrCreateWorkspaceMetrics(workspaceId);
  const bucket = state[event];
  bucket.attempted += 1;
  bucket.failed += 1;
  bucket.lastUpdatedAt = new Date().toISOString();
  bucket.lastError = error instanceof Error ? error.message : 'Unknown notification error';
};

export const buildQuoteNotificationsService = (
  overrides: Partial<QuoteNotificationsDependencies> = {},
) => {
  const dependencies: QuoteNotificationsDependencies = {
    getNotificationSettings: overrides.getNotificationSettings ?? quotesRepository.getNotificationSettings,
    upsertNotificationSettings: overrides.upsertNotificationSettings ?? quotesRepository.upsertNotificationSettings,
    findBrandingByWorkspaceId: overrides.findBrandingByWorkspaceId ?? brandingRepository.findByWorkspaceId,
    renderQuotePdfFn: overrides.renderQuotePdfFn ?? renderQuotePdf,
    // Niente ripiego di sviluppo qui: una notifica di preventivo non deve
    // risultare "recapitata" perche' e' finita in una casella finta.
    // Il workspace serve a usare il server di posta configurato dalla pagina
    // "Server di posta": senza, si spedirebbe sempre con le variabili
    // d'ambiente e configurare dall'interfaccia non cambierebbe niente qui.
    resolveTransport:
      overrides.resolveTransport
      ?? ((workspaceId: string) => resolveMailTransportDettagliato({ workspaceId })),
  };

  return {
    async getTemplates(workspaceId: string) {
      return resolveWorkspaceTemplates(dependencies, workspaceId);
    },

    async notifyQuoteEvent(input: NotifyQuoteEventInput): Promise<NotifyQuoteEventResult> {
      const recipient = input.quote.client.email?.trim().toLowerCase() || null;
      if (!recipient) {
        const result = {
          delivered: false,
          skippedReason: 'CLIENT_EMAIL_MISSING',
        } satisfies NotifyQuoteEventResult;
        updateMetricsForResult(input.workspaceId, input.event, result);
        return result;
      }

      const templates = await resolveWorkspaceTemplates(dependencies, input.workspaceId);
      if (!templates.enabled) {
        const result = {
          delivered: false,
          skippedReason: 'NOTIFICATIONS_DISABLED',
        } satisfies NotifyQuoteEventResult;
        updateMetricsForResult(input.workspaceId, input.event, result);
        return result;
      }

      const mail = await dependencies.resolveTransport(input.workspaceId);
      if (mail.esito !== 'ok') {
        // I due guasti restano distinti anche nei contatori: "non configurato"
        // si risolve configurando, "illeggibile" reinserendo la password dopo
        // un cambio di chiave di cifratura. Appiattirli manderebbe chi guarda
        // le metriche a riscrivere parametri che erano gia' giusti.
        const result = {
          delivered: false,
          skippedReason:
            mail.esito === 'illeggibile' ? 'MAIL_CONFIG_UNREADABLE' : 'MAIL_NOT_CONFIGURED',
        } satisfies NotifyQuoteEventResult;
        updateMetricsForResult(input.workspaceId, input.event, result);
        return result;
      }

      try {
        const branding = await dependencies.findBrandingByWorkspaceId(input.workspaceId);
        const workspaceName = branding?.workspaceName?.trim() || 'Workspace';

        const quoteNumber = input.quote.id.slice(0, 8).toUpperCase();
        const template = templates[input.event];
        const payload = {
          clientName: input.quote.client.name || 'Cliente',
          quoteNumber,
          workspaceName,
          status: input.event,
          total: formatMoney(input.quote.total, input.quote.currency),
        };

        const subject = renderQuoteNotificationTemplate(template.subject, payload);
        const text = renderQuoteNotificationTemplate(template.body, payload);

        const attachments =
          input.event === 'SENT' && input.quotePdfData
            ? [await buildPdfAttachment(
              dependencies,
              workspaceName,
              input.workspaceId,
              input.quotePdfData,
              branding,
            )]
            : undefined;

        const info = await mail.transport.sendMail({
          from: mail.from,
          to: recipient,
          subject,
          text,
          ...(attachments ? { attachments } : {}),
        });

        const result = {
          delivered: true,
          providerMessageId: typeof info.messageId === 'string' ? info.messageId : null,
        } satisfies NotifyQuoteEventResult;
        updateMetricsForResult(input.workspaceId, input.event, result);
        return result;
      } catch (error) {
        updateMetricsForError(input.workspaceId, input.event, error);
        throw error;
      }
    },

    async updateTemplates(
      workspaceId: string,
      payload: QuoteNotificationTemplatePayload,
    ) {
      const updated = await dependencies.upsertNotificationSettings(workspaceId, payload);

      return {
        enabled: updated.enabled,
        sentSubject: updated.sentSubject,
        sentBody: updated.sentBody,
        acceptedSubject: updated.acceptedSubject,
        acceptedBody: updated.acceptedBody,
        rejectedSubject: updated.rejectedSubject,
        rejectedBody: updated.rejectedBody,
        updatedAt: updated.updatedAt,
      };
    },
  };
};

export const quoteNotificationsService = buildQuoteNotificationsService();

export const quoteNotificationEventFieldMap = eventFieldMap;

export const quoteNotificationsMetrics = {
  getWorkspaceSnapshot(workspaceId: string) {
    const current = quoteNotificationsMetricsState.get(workspaceId) ?? createWorkspaceNotificationsMetrics();

    return {
      SENT: {
        ...current.SENT,
        bySkipReason: { ...current.SENT.bySkipReason },
      },
      ACCEPTED: {
        ...current.ACCEPTED,
        bySkipReason: { ...current.ACCEPTED.bySkipReason },
      },
      REJECTED: {
        ...current.REJECTED,
        bySkipReason: { ...current.REJECTED.bySkipReason },
      },
      generatedAt: new Date().toISOString(),
    };
  },
};
