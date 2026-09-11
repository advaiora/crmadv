export type ErrorDetails = Record<string, unknown> | string | number | boolean | null;

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ErrorDetails;

  constructor(statusCode: number, code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: ErrorDetails) =>
  new HttpError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message: string, details?: ErrorDetails) =>
  new HttpError(401, 'UNAUTHORIZED', message, details);

export const forbidden = (message: string, details?: ErrorDetails) =>
  new HttpError(403, 'FORBIDDEN', message, details);

// Codice dedicato al solo 403 che significa "non sei (piu') membro di questo
// workspace". Il frontend lo distingue dal `FORBIDDEN` generico per chiudere la
// sessione soltanto in questo caso: un permesso mancante non deve buttare fuori
// nessuno (`WORKSPACE_MEMBERSHIP_REQUIRED_ERROR_CODE` in src/lib/apiFetch.ts,
// CRMA-158). La stringa e' un contratto fra i due lati: se cambia qui, cambia
// anche la costante del frontend, nello stesso lavoro.
// ⚠️ `forbidden()` qui sopra NON va toccato: lo usano decine di punti di chiamata
// che devono restare `FORBIDDEN`, a partire da requirePermission.
export const WORKSPACE_MEMBERSHIP_REQUIRED_CODE = 'WORKSPACE_MEMBERSHIP_REQUIRED';

export const workspaceMembershipRequired = (message: string, details?: ErrorDetails) =>
  new HttpError(403, WORKSPACE_MEMBERSHIP_REQUIRED_CODE, message, details);

export const notFound = (message: string, details?: ErrorDetails) =>
  new HttpError(404, 'NOT_FOUND', message, details);

export const conflict = (message: string, details?: ErrorDetails) =>
  new HttpError(409, 'CONFLICT', message, details);

export const internalServerError = (message = 'Internal server error', details?: ErrorDetails) =>
  new HttpError(500, 'INTERNAL_SERVER_ERROR', message, details);

export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof HttpError;
