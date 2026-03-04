export const formatNumber = (value, locale = 'it-IT') => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '0';
  }

  return new Intl.NumberFormat(locale).format(numericValue);
};

export const formatDate = (
  value,
  {
    locale = 'it-IT',
    dateStyle = 'medium',
  } = {},
) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, { dateStyle }).format(parsed);
};

export const formatDateTime = (
  value,
  {
    locale = 'it-IT',
    dateStyle = 'medium',
    timeStyle = 'short',
  } = {},
) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, { dateStyle, timeStyle }).format(parsed);
};

export const formatRelativeTime = (value, nowValue = new Date()) => {
  if (!value) {
    return 'adesso';
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'adesso';
  }

  const diffMs = Math.max(0, nowValue.getTime() - parsed.getTime());
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 10) {
    return 'adesso';
  }

  if (diffSeconds < 60) {
    return `${diffSeconds}s fa`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m fa`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h fa`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}g fa`;
};
