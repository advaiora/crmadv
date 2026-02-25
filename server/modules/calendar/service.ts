import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { badRequest, notFound } from '../../core/errors.js';
import { prisma } from '../../prisma.js';

const HEX_COLOR_PATTERN = /^#[A-Fa-f0-9]{6}$/;
const DEFAULT_CUSTOM_EVENT_COLOR = '#0d6efd';
const DEFAULT_PROJECT_EVENT_COLOR = '#f59e0b';
const DEFAULT_QUOTE_EVENT_COLOR = '#ef4444';

type CalendarSourceType =
  | 'custom'
  | 'project_due'
  | 'quote_issue_date'
  | 'quote_valid_until';

type CalendarRefType = 'calendar_event' | 'project' | 'quote';

export type CalendarEventListItem = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  editable: boolean;
  sourceType: CalendarSourceType;
  sourceRefType: CalendarRefType;
  sourceRefId: string;
  description: string | null;
  location: string | null;
  category: string | null;
  url: string | null;
  updatedAt: string;
};

type ListEventsOptions = {
  includeProjectDue?: boolean;
  includeQuoteDates?: boolean;
};

const optionalNullableTextField = (maxLength: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null) {
        return null;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      }

      return value;
    },
    z.union([z.string().max(maxLength), z.null()]).optional(),
  );

const optionalNullableHexColorField = z.preprocess(
  (value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      return trimmed.length > 0 ? trimmed : null;
    }

    return value;
  },
  z.union([z.string().regex(HEX_COLOR_PATTERN), z.null()]).optional(),
);

const listQuerySchema = z
  .object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    includeDerived: z
      .preprocess((value) => {
        if (typeof value === 'boolean') {
          return value;
        }

        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase();
          if (normalized === 'true' || normalized === '1') {
            return true;
          }
          if (normalized === 'false' || normalized === '0') {
            return false;
          }
        }

        return undefined;
      }, z.boolean().optional())
      .default(true),
  })
  .superRefine((value, context) => {
    const hasStart = Boolean(value.start);
    const hasEnd = Boolean(value.end);

    if (hasStart !== hasEnd) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'start and end must be provided together',
        path: !hasStart ? ['start'] : ['end'],
      });
    }

    if (value.start && value.end && new Date(value.start) >= new Date(value.end)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'start must be earlier than end',
        path: ['start'],
      });
    }
  });

const createEventSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: optionalNullableTextField(2000),
    location: optionalNullableTextField(160),
    category: optionalNullableTextField(60),
    color: optionalNullableHexColorField,
    startAt: z.string().datetime(),
    endAt: z.string().datetime().optional().nullable(),
    allDay: z.boolean().optional().default(false),
  })
  .superRefine((value, context) => {
    if (value.endAt && new Date(value.endAt) < new Date(value.startAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endAt must be equal or later than startAt',
        path: ['endAt'],
      });
    }
  });

const updateEventSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: optionalNullableTextField(2000),
    location: optionalNullableTextField(160),
    category: optionalNullableTextField(60),
    color: optionalNullableHexColorField,
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional().nullable(),
    allDay: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

const toDateRange = (query: z.infer<typeof listQuerySchema>) => {
  if (!query.start || !query.end) {
    return null;
  }

  return {
    start: new Date(query.start),
    end: new Date(query.end),
  };
};

const toIso = (value: Date) => value.toISOString();

const resolveTextColor = (hexColor: string) => {
  const r = Number.parseInt(hexColor.slice(1, 3), 16);
  const g = Number.parseInt(hexColor.slice(3, 5), 16);
  const b = Number.parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return luminance > 0.62 ? '#111111' : '#ffffff';
};

const normalizeColor = (input: string | null | undefined, fallback: string) => {
  const normalized = typeof input === 'string' ? input.trim() : '';
  if (!HEX_COLOR_PATTERN.test(normalized)) {
    return fallback;
  }

  return normalized.toLowerCase();
};

const isMidnightUtc = (value: Date) =>
  value.getUTCHours() === 0 &&
  value.getUTCMinutes() === 0 &&
  value.getUTCSeconds() === 0 &&
  value.getUTCMilliseconds() === 0;

const mapCustomEvent = (
  item: {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    category: string | null;
    color: string | null;
    startAt: Date;
    endAt: Date | null;
    allDay: boolean;
    updatedAt: Date;
  },
): CalendarEventListItem => {
  const color = normalizeColor(item.color, DEFAULT_CUSTOM_EVENT_COLOR);

  return {
    id: item.id,
    title: item.title,
    start: toIso(item.startAt),
    end: item.endAt ? toIso(item.endAt) : null,
    allDay: item.allDay,
    backgroundColor: color,
    borderColor: color,
    textColor: resolveTextColor(color),
    editable: true,
    sourceType: 'custom',
    sourceRefType: 'calendar_event',
    sourceRefId: item.id,
    description: item.description,
    location: item.location,
    category: item.category,
    url: null,
    updatedAt: toIso(item.updatedAt),
  };
};

const mapProjectDueEvent = (item: {
  id: string;
  name: string;
  dueDate: Date | null;
  updatedAt: Date;
}): CalendarEventListItem | null => {
  if (!item.dueDate) {
    return null;
  }

  const color = DEFAULT_PROJECT_EVENT_COLOR;

  return {
    id: `project_due:${item.id}`,
    title: `Scadenza progetto: ${item.name}`,
    start: toIso(item.dueDate),
    end: null,
    allDay: isMidnightUtc(item.dueDate),
    backgroundColor: color,
    borderColor: color,
    textColor: resolveTextColor(color),
    editable: false,
    sourceType: 'project_due',
    sourceRefType: 'project',
    sourceRefId: item.id,
    description: null,
    location: null,
    category: 'Progetti',
    url: `/projects/${item.id}`,
    updatedAt: toIso(item.updatedAt),
  };
};

const shortQuoteId = (quoteId: string) => quoteId.slice(0, 8).toUpperCase();

const mapQuoteDateEvent = (input: {
  quoteId: string;
  date: Date;
  type: 'quote_issue_date' | 'quote_valid_until';
  updatedAt: Date;
}): CalendarEventListItem => {
  const color = DEFAULT_QUOTE_EVENT_COLOR;
  const label =
    input.type === 'quote_issue_date'
      ? `Emissione preventivo #${shortQuoteId(input.quoteId)}`
      : `Scadenza preventivo #${shortQuoteId(input.quoteId)}`;

  return {
    id: `${input.type}:${input.quoteId}`,
    title: label,
    start: toIso(input.date),
    end: null,
    allDay: isMidnightUtc(input.date),
    backgroundColor: color,
    borderColor: color,
    textColor: resolveTextColor(color),
    editable: false,
    sourceType: input.type,
    sourceRefType: 'quote',
    sourceRefId: input.quoteId,
    description: null,
    location: null,
    category: 'Preventivi',
    url: `/apps/quotes/${input.quoteId}`,
    updatedAt: toIso(input.updatedAt),
  };
};

const buildCustomEventsWhere = (
  workspaceId: string,
  range: { start: Date; end: Date } | null,
): Prisma.CalendarEventWhereInput => {
  if (!range) {
    return { workspaceId };
  }

  return {
    workspaceId,
    OR: [
      {
        AND: [
          { endAt: { not: null } },
          { startAt: { lt: range.end } },
          { endAt: { gte: range.start } },
        ],
      },
      {
        AND: [
          { endAt: null },
          { startAt: { gte: range.start, lt: range.end } },
        ],
      },
    ],
  };
};

const parseListQuery = (query: unknown) => {
  const parsed = listQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw badRequest('Invalid calendar list query', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseCreatePayload = (payload: unknown) => {
  const parsed = createEventSchema.safeParse(payload);
  if (!parsed.success) {
    throw badRequest('Invalid calendar event payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const parseUpdatePayload = (payload: unknown) => {
  const parsed = updateEventSchema.safeParse(payload);
  if (!parsed.success) {
    throw badRequest('Invalid calendar event payload', {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

const ensureCalendarEvent = async (workspaceId: string, eventId: string) => {
  const event = await prisma.calendarEvent.findFirst({
    where: {
      workspaceId,
      id: eventId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      category: true,
      color: true,
      startAt: true,
      endAt: true,
      allDay: true,
      updatedAt: true,
    },
  });

  if (!event) {
    throw notFound('Calendar event not found');
  }

  return event;
};

export const calendarService = {
  parseListQuery,
  parseCreatePayload,
  parseUpdatePayload,

  async listEvents(
    workspaceId: string,
    queryInput: unknown,
    options: ListEventsOptions = {},
  ) {
    const parsedQuery = parseListQuery(queryInput);
    const range = toDateRange(parsedQuery);
    const includeProjectDue = options.includeProjectDue !== false;
    const includeQuoteDates = options.includeQuoteDates !== false;

    const customEvents = await prisma.calendarEvent.findMany({
      where: buildCustomEventsWhere(workspaceId, range),
      orderBy: {
        startAt: 'asc',
      },
      take: range ? 1000 : 300,
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        category: true,
        color: true,
        startAt: true,
        endAt: true,
        allDay: true,
        updatedAt: true,
      },
    });

    let derivedEvents: CalendarEventListItem[] = [];
    if (parsedQuery.includeDerived) {
      const [projects, quotes] = await Promise.all([
        includeProjectDue
          ? prisma.project.findMany({
              where: {
                workspaceId,
                dueDate: range
                  ? {
                      gte: range.start,
                      lt: range.end,
                    }
                  : {
                      not: null,
                    },
              },
              select: {
                id: true,
                name: true,
                dueDate: true,
                updatedAt: true,
              },
              orderBy: {
                dueDate: 'asc',
              },
              take: range ? 1000 : 300,
            })
          : Promise.resolve([]),
        includeQuoteDates
          ? prisma.quote.findMany({
              where: {
                workspaceId,
                ...(range
                  ? {
                      OR: [
                        {
                          issueDate: {
                            gte: range.start,
                            lt: range.end,
                          },
                        },
                        {
                          validUntil: {
                            gte: range.start,
                            lt: range.end,
                          },
                        },
                      ],
                    }
                  : {
                      OR: [{ issueDate: { not: null } }, { validUntil: { not: null } }],
                    }),
              },
              select: {
                id: true,
                issueDate: true,
                validUntil: true,
                updatedAt: true,
              },
              orderBy: {
                updatedAt: 'desc',
              },
              take: range ? 1000 : 500,
            })
          : Promise.resolve([]),
      ]);

      const projectEvents = includeProjectDue
        ? projects
            .map((project) => mapProjectDueEvent(project))
            .filter((item): item is CalendarEventListItem => Boolean(item))
        : [];

      const quoteEvents: CalendarEventListItem[] = [];
      if (includeQuoteDates) {
        for (const quote of quotes) {
          if (quote.issueDate) {
            quoteEvents.push(
              mapQuoteDateEvent({
                quoteId: quote.id,
                date: quote.issueDate,
                type: 'quote_issue_date',
                updatedAt: quote.updatedAt,
              }),
            );
          }

          if (quote.validUntil) {
            quoteEvents.push(
              mapQuoteDateEvent({
                quoteId: quote.id,
                date: quote.validUntil,
                type: 'quote_valid_until',
                updatedAt: quote.updatedAt,
              }),
            );
          }
        }
      }

      derivedEvents = [...projectEvents, ...quoteEvents];
    }

    const items = [...customEvents.map((item) => mapCustomEvent(item)), ...derivedEvents].sort((a, b) => {
      const aTime = new Date(a.start).getTime();
      const bTime = new Date(b.start).getTime();
      return aTime - bTime;
    });

    return {
      items,
      meta: {
        includeDerived: parsedQuery.includeDerived,
        includeProjectDue: parsedQuery.includeDerived && includeProjectDue,
        includeQuoteDates: parsedQuery.includeDerived && includeQuoteDates,
        rangeStart: range?.start.toISOString() ?? null,
        rangeEnd: range?.end.toISOString() ?? null,
      },
    };
  },

  async createEvent(input: {
    workspaceId: string;
    actorUserId: string;
    payload: unknown;
  }) {
    const payload = parseCreatePayload(input.payload);

    const created = await prisma.calendarEvent.create({
      data: {
        workspaceId: input.workspaceId,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
        title: payload.title,
        description: payload.description ?? null,
        location: payload.location ?? null,
        category: payload.category ?? null,
        color: payload.color ?? DEFAULT_CUSTOM_EVENT_COLOR,
        startAt: new Date(payload.startAt),
        endAt: payload.endAt ? new Date(payload.endAt) : null,
        allDay: payload.allDay,
      },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        category: true,
        color: true,
        startAt: true,
        endAt: true,
        allDay: true,
        updatedAt: true,
      },
    });

    return mapCustomEvent(created);
  },

  async updateEvent(input: {
    workspaceId: string;
    actorUserId: string;
    eventId: string;
    payload: unknown;
  }) {
    const payload = parseUpdatePayload(input.payload);
    const existing = await ensureCalendarEvent(input.workspaceId, input.eventId);

    const nextStartAt = payload.startAt ? new Date(payload.startAt) : existing.startAt;
    const nextEndAt = payload.endAt !== undefined ? (payload.endAt ? new Date(payload.endAt) : null) : existing.endAt;

    if (nextEndAt && nextEndAt < nextStartAt) {
      throw badRequest('endAt must be equal or later than startAt');
    }

    const updated = await prisma.calendarEvent.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.location !== undefined ? { location: payload.location } : {}),
        ...(payload.category !== undefined ? { category: payload.category } : {}),
        ...(payload.color !== undefined ? { color: payload.color ?? DEFAULT_CUSTOM_EVENT_COLOR } : {}),
        ...(payload.startAt !== undefined ? { startAt: nextStartAt } : {}),
        ...(payload.endAt !== undefined ? { endAt: nextEndAt } : {}),
        ...(payload.allDay !== undefined ? { allDay: payload.allDay } : {}),
        updatedByUserId: input.actorUserId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        category: true,
        color: true,
        startAt: true,
        endAt: true,
        allDay: true,
        updatedAt: true,
      },
    });

    return mapCustomEvent(updated);
  },

  async deleteEvent(input: {
    workspaceId: string;
    eventId: string;
  }) {
    const existing = await ensureCalendarEvent(input.workspaceId, input.eventId);

    await prisma.calendarEvent.delete({
      where: {
        id: existing.id,
      },
    });

    return {
      deleted: true,
      id: existing.id,
    };
  },
};
