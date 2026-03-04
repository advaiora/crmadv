import { HttpError, badRequest, internalServerError, isHttpError } from '../../core/errors.js';

const GENERIC_VAULT_PAYLOAD_ERROR_MESSAGE = 'Invalid vault payload';
const GENERIC_VAULT_INTERNAL_ERROR_MESSAGE = 'Vault operation failed';

const DECRYPTION_ERROR_MARKERS = [
  'unable to authenticate data',
  'invalid authentication tag',
  'unsupported state or unable to authenticate data',
  'decrypt',
  'invalid vault payload',
] as const;

const normalizeErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.trim().toLowerCase();
  }

  return '';
};

const isDecryptionLikeError = (error: unknown) => {
  const normalizedMessage = normalizeErrorMessage(error);
  if (!normalizedMessage) {
    return false;
  }

  return DECRYPTION_ERROR_MARKERS.some((marker) => normalizedMessage.includes(marker));
};

export const toSafeVaultError = (error: unknown): HttpError => {
  if (isHttpError(error)) {
    return error;
  }

  if (isDecryptionLikeError(error)) {
    return badRequest(GENERIC_VAULT_PAYLOAD_ERROR_MESSAGE);
  }

  return internalServerError(GENERIC_VAULT_INTERNAL_ERROR_MESSAGE);
};

