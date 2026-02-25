import { Prisma } from '@prisma/client';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('it-IT', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const INTEGER_FORMATTER = new Intl.NumberFormat('it-IT');

export const formatMoney = (value: Prisma.Decimal, currency = 'EUR') => {
  const safeCurrency = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency.toUpperCase())
    ? currency.toUpperCase()
    : 'EUR';

  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: safeCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value.toFixed(2)));
};

export const formatDateTime = (value: Date) => DATE_TIME_FORMATTER.format(value);

export const formatQty = (value: number) => INTEGER_FORMATTER.format(value);
