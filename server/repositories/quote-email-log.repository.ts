import type { EmailSendStatus, QuoteEmailLogType } from '@prisma/client';
import { prisma } from '../prisma.js';

type CreateQuoteEmailLogInput = {
  workspaceId: string;
  quoteId: string;
  type: QuoteEmailLogType;
  toMasked: string;
  ccCount: number;
  bccCount: number;
  subject: string | null;
  downloadName: string | null;
  provider: string;
  providerMessageId: string | null;
  status: EmailSendStatus;
  errorCode: string | null;
  errorMessage: string | null;
};

const quoteEmailLogSelect = {
  id: true,
  type: true,
  status: true,
  toMasked: true,
  ccCount: true,
  bccCount: true,
  subject: true,
  downloadName: true,
  provider: true,
  providerMessageId: true,
  errorCode: true,
  errorMessage: true,
  createdAt: true,
} as const;

export const quoteEmailLogRepository = {
  create(input: CreateQuoteEmailLogInput) {
    return prisma.quoteEmailLog.create({
      data: {
        workspaceId: input.workspaceId,
        quoteId: input.quoteId,
        type: input.type,
        toMasked: input.toMasked,
        ccCount: input.ccCount,
        bccCount: input.bccCount,
        subject: input.subject,
        downloadName: input.downloadName,
        provider: input.provider,
        providerMessageId: input.providerMessageId,
        status: input.status,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      },
      select: quoteEmailLogSelect,
    });
  },

  listByQuote(workspaceId: string, quoteId: string) {
    return prisma.quoteEmailLog.findMany({
      where: {
        workspaceId,
        quoteId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: quoteEmailLogSelect,
    });
  },
};

