import type { FastifyRequest } from 'fastify';

const readHeader = (headerValue: string | string[] | undefined): string | undefined => {
  if (Array.isArray(headerValue)) {
    return headerValue[0]?.trim() || undefined;
  }

  return headerValue?.trim() || undefined;
};

export type DevIdentity = {
  userId?: string;
  email?: string;
};

export const resolveDevIdentity = (request: FastifyRequest): DevIdentity => {
  const userId = readHeader(request.headers['x-user-id']);
  const email = readHeader(request.headers['x-user-email']);

  return { userId, email };
};

export const readHeaderValue = (request: FastifyRequest, name: string): string | undefined =>
  readHeader(request.headers[name.toLowerCase()] as string | string[] | undefined);
