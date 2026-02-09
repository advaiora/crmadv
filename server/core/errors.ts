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

export const notFound = (message: string, details?: ErrorDetails) =>
  new HttpError(404, 'NOT_FOUND', message, details);

export const internalServerError = (message = 'Internal server error', details?: ErrorDetails) =>
  new HttpError(500, 'INTERNAL_SERVER_ERROR', message, details);

export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof HttpError;
