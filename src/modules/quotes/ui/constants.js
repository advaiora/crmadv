export const QUOTES_MODULE_KEY = 'quotes';

export const QUOTES_PERMISSIONS = {
  view: 'quotes.view',
  create: 'quotes.create',
  edit: 'quotes.edit',
  delete: 'quotes.delete',
  send: 'quotes.send',
  accept: 'quotes.accept',
  manageTemplates: 'quotes.manage_templates',
};

export const QUOTE_STATUSES = [
  { value: 'DRAFT', label: 'Bozza' },
  { value: 'SENT', label: 'Inviato' },
  { value: 'ACCEPTED', label: 'Accettato' },
  { value: 'REJECTED', label: 'Rifiutato' },
  { value: 'EXPIRED', label: 'Scaduto' },
];

export const QUOTES_PAGE_SIZE_OPTIONS = [10, 20, 50];

export const MAX_QUOTE_ITEMS = 200;

export const DEFAULT_CURRENCY = 'EUR';
export const DEFAULT_TAX_RATE = 22;
