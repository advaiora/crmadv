import { Prisma } from '@prisma/client';

const EURO_FORMATTER = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('it-IT', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const INTEGER_FORMATTER = new Intl.NumberFormat('it-IT');

export const formatMoney = (value: Prisma.Decimal) =>
  EURO_FORMATTER.format(Number(value.toFixed(2)));

export const formatDateTime = (value: Date) => DATE_TIME_FORMATTER.format(value);

export const formatQty = (value: number) => INTEGER_FORMATTER.format(value);
