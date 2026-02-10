import { Prisma } from '@prisma/client';
import { badRequest } from '../core/errors.js';

export const parseMoneyDecimal = (value: unknown, fieldName: string): Prisma.Decimal => {
  let rawValue: string;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw badRequest(`${fieldName} must be a finite number`);
    }
    rawValue = value.toString();
  } else if (typeof value === 'string' && value.trim()) {
    rawValue = value.trim();
  } else {
    throw badRequest(`${fieldName} must be a number`);
  }

  if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
    throw badRequest(`${fieldName} must have at most 2 decimal places`);
  }

  const decimalValue = new Prisma.Decimal(rawValue);
  if (decimalValue.isNegative()) {
    throw badRequest(`${fieldName} must be >= 0`);
  }

  return decimalValue;
};

export const computeLineTotal = (qty: number, unitPrice: Prisma.Decimal) =>
  unitPrice.mul(new Prisma.Decimal(qty));

export const computeQuoteTotal = (lineTotals: Prisma.Decimal[]) =>
  lineTotals.reduce((acc, lineTotal) => acc.add(lineTotal), new Prisma.Decimal(0));
