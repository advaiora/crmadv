const MAX_EMAIL_ERROR_MESSAGE_LENGTH = 300;

export const maskEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0) {
    return '***';
  }

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  if (!domain) {
    return '***';
  }

  const firstChar = local[0] ?? '*';
  return `${firstChar}***@${domain}`;
};

export const sanitizeEmailError = (error: unknown) => {
  const fallback = {
    errorCode: 'EMAIL_SEND_FAILED',
    errorMessage: 'Email delivery failed',
  };

  if (!(error instanceof Error)) {
    return fallback;
  }

  const codeCandidate = (error as Error & { code?: unknown }).code;
  const rawCode =
    typeof codeCandidate === 'string' ? codeCandidate : fallback.errorCode;
  const errorCode = rawCode.trim().toUpperCase().slice(0, 60) || fallback.errorCode;

  const compactMessage = error.message.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const errorMessage =
    (compactMessage || fallback.errorMessage).slice(0, MAX_EMAIL_ERROR_MESSAGE_LENGTH) ||
    fallback.errorMessage;

  return {
    errorCode,
    errorMessage,
  };
};
