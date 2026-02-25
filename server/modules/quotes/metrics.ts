type QuoteOperationName =
  | 'create'
  | 'update'
  | 'delete'
  | 'send'
  | 'accept'
  | 'reject'
  | 'cancelSend'
  | 'resend'
  | 'exportPdf'
  | 'updateNotificationTemplates';

type QuoteOperationBucket = {
  total: number;
  success: number;
  error: number;
  avgDurationMs: number;
  lastDurationMs: number | null;
  lastUpdatedAt: string | null;
};

type WorkspaceMetricsState = {
  operations: Record<QuoteOperationName, QuoteOperationBucket>;
};

const QUOTE_OPERATION_NAMES: QuoteOperationName[] = [
  'create',
  'update',
  'delete',
  'send',
  'accept',
  'reject',
  'cancelSend',
  'resend',
  'exportPdf',
  'updateNotificationTemplates',
];

const createOperationBucket = (): QuoteOperationBucket => ({
  total: 0,
  success: 0,
  error: 0,
  avgDurationMs: 0,
  lastDurationMs: null,
  lastUpdatedAt: null,
});

const createWorkspaceMetricsState = (): WorkspaceMetricsState => ({
  operations: {
    create: createOperationBucket(),
    update: createOperationBucket(),
    delete: createOperationBucket(),
    send: createOperationBucket(),
    accept: createOperationBucket(),
    reject: createOperationBucket(),
    cancelSend: createOperationBucket(),
    resend: createOperationBucket(),
    exportPdf: createOperationBucket(),
    updateNotificationTemplates: createOperationBucket(),
  },
});

const perWorkspaceMetrics = new Map<string, WorkspaceMetricsState>();

const getOrCreateWorkspaceMetrics = (workspaceId: string) => {
  const existing = perWorkspaceMetrics.get(workspaceId);
  if (existing) {
    return existing;
  }

  const state = createWorkspaceMetricsState();
  perWorkspaceMetrics.set(workspaceId, state);
  return state;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const quotesMetrics = {
  recordOperation(
    workspaceId: string,
    operation: QuoteOperationName,
    durationMs: number,
    success: boolean,
  ) {
    const safeDuration = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0;
    const state = getOrCreateWorkspaceMetrics(workspaceId);
    const bucket = state.operations[operation];
    bucket.total += 1;
    if (success) {
      bucket.success += 1;
    } else {
      bucket.error += 1;
    }

    bucket.avgDurationMs = round2(((bucket.avgDurationMs * (bucket.total - 1)) + safeDuration) / bucket.total);
    bucket.lastDurationMs = round2(safeDuration);
    bucket.lastUpdatedAt = new Date().toISOString();
  },

  getWorkspaceSnapshot(workspaceId: string) {
    const state = perWorkspaceMetrics.get(workspaceId) ?? createWorkspaceMetricsState();
    const operations = QUOTE_OPERATION_NAMES.reduce((accumulator, operation) => {
      accumulator[operation] = { ...state.operations[operation] };
      return accumulator;
    }, {} as Record<QuoteOperationName, QuoteOperationBucket>);

    return {
      operations,
      generatedAt: new Date().toISOString(),
    };
  },
};

export type { QuoteOperationName };
