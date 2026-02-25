import { DEFAULT_CURRENCY } from './constants';

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
};

const round2 = (value) => Math.round((toSafeNumber(value, 0) + Number.EPSILON) * 100) / 100;

export const createEmptyQuoteItem = (position = 1) => ({
  position,
  title: '',
  description: '',
  quantity: '1',
  unitPrice: '0',
  discountType: null,
  discountValue: '',
});

export const normalizeQuoteItemForForm = (item, index = 0) => ({
  id: item?.id,
  position: Number(item?.position) > 0 ? Number(item.position) : index + 1,
  title: item?.title || '',
  description: item?.description || '',
  quantity: String(item?.quantity ?? '1'),
  unitPrice: String(item?.unitPrice ?? '0'),
  discountType: item?.discountType || null,
  discountValue:
    item?.discountValue === null || item?.discountValue === undefined
      ? ''
      : String(item.discountValue),
});

export const computeLineTotal = (item) => {
  const quantity = Math.max(0, toSafeNumber(item?.quantity, 0));
  const unitPrice = Math.max(0, toSafeNumber(item?.unitPrice, 0));
  const discountValue = Math.max(0, toSafeNumber(item?.discountValue, 0));

  const base = quantity * unitPrice;
  let discount = 0;

  if (item?.discountType === 'PERCENT') {
    discount = (base * Math.min(discountValue, 100)) / 100;
  } else if (item?.discountType === 'FIXED') {
    discount = Math.min(discountValue, base);
  }

  return round2(base - discount);
};

export const computeQuoteTotals = (items, taxRate) => {
  const subtotal = round2((Array.isArray(items) ? items : []).reduce((accumulator, item) => {
    return accumulator + computeLineTotal(item);
  }, 0));

  const rate = Math.max(0, toSafeNumber(taxRate, 0));
  const taxTotal = round2((subtotal * rate) / 100);
  const total = round2(subtotal + taxTotal);

  return {
    subtotal,
    taxTotal,
    total,
  };
};

export const normalizeItemsForPayload = (items) => {
  const normalizedItems = (Array.isArray(items) ? items : []).map((item, index) => {
    const quantity = toSafeNumber(item?.quantity, NaN);
    const unitPrice = toSafeNumber(item?.unitPrice, NaN);
    const discountValueRaw = item?.discountValue;
    const hasDiscountValue = discountValueRaw !== '' && discountValueRaw !== null && discountValueRaw !== undefined;
    const discountValue = hasDiscountValue ? toSafeNumber(discountValueRaw, NaN) : null;

    return {
      position: index + 1,
      title: String(item?.title || '').trim(),
      description: String(item?.description || '').trim() || null,
      quantity,
      unitPrice,
      discountType: item?.discountType || null,
      discountValue,
    };
  });

  normalizedItems.forEach((item, index) => {
    if (!item.title) {
      throw new Error(`La voce ${index + 1} richiede una descrizione.`);
    }

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error(`La quantita della voce ${index + 1} deve essere maggiore di 0.`);
    }

    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      throw new Error(`Il prezzo unitario della voce ${index + 1} deve essere maggiore o uguale a 0.`);
    }

    if (item.discountValue !== null) {
      if (!Number.isFinite(item.discountValue) || item.discountValue < 0) {
        throw new Error(`Lo sconto della voce ${index + 1} deve essere maggiore o uguale a 0.`);
      }
    }
  });

  return normalizedItems;
};

export const formatCurrency = (value, currency = DEFAULT_CURRENCY) => {
  const safeCurrency = typeof currency === 'string' && currency.trim().length === 3
    ? currency.trim().toUpperCase()
    : DEFAULT_CURRENCY;

  try {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toSafeNumber(value, 0));
  } catch (_error) {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: DEFAULT_CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toSafeNumber(value, 0));
  }
};

export const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const formatDateOnly = (value) => {
  if (!value) {
    return '-';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
  }).format(date);
};

export const toInputDateValue = (value) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const shortQuoteId = (quoteId) => {
  if (typeof quoteId !== 'string' || quoteId.length === 0) {
    return '-';
  }

  return quoteId.slice(0, 8).toUpperCase();
};

export const triggerBlobDownload = (blob, filename) => {
  const downloadName = filename || 'download.bin';
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = downloadName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
};

export const getApiErrorMessage = (error, {
  forbiddenMessage = 'Non hai permessi',
  notFoundMessage = 'Risorsa non trovata',
  conflictMessage = 'Operazione non valida per lo stato attuale',
  fallbackMessage = 'Operazione non riuscita',
} = {}) => {
  const status = Number(error?.status);

  if (status === 403) {
    return forbiddenMessage;
  }

  if (status === 404) {
    return notFoundMessage;
  }

  if (status === 409) {
    return conflictMessage;
  }

  return error?.message || fallbackMessage;
};
