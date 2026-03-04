import type { FastifyReply } from 'fastify';

type SerializeCookieInput = {
  name: string;
  value: string;
  path: string;
  maxAgeSeconds: number;
  sameSite: 'lax' | 'strict';
  secure: boolean;
  httpOnly?: boolean;
};

const readSingleHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const parseCookies = (cookieHeader: string | string[] | undefined): Record<string, string> => {
  const rawHeader = readSingleHeaderValue(cookieHeader);
  if (!rawHeader) {
    return {};
  }

  return rawHeader.split(';').reduce<Record<string, string>>((acc, entry) => {
    const index = entry.indexOf('=');
    if (index <= 0) {
      return acc;
    }

    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim();
    if (!key) {
      return acc;
    }

    try {
      acc[key] = decodeURIComponent(value);
      return acc;
    } catch {
      return acc;
    }
  }, {});
};

export const serializeCookie = (input: SerializeCookieInput) => {
  const parts = [
    `${input.name}=${encodeURIComponent(input.value)}`,
    `Path=${input.path}`,
    `Max-Age=${Math.max(0, Math.floor(input.maxAgeSeconds))}`,
    `SameSite=${input.sameSite === 'strict' ? 'Strict' : 'Lax'}`,
  ];

  if (input.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  if (input.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
};

export const appendSetCookieHeader = (reply: FastifyReply, cookieValue: string) => {
  const existing = reply.getHeader('Set-Cookie');
  if (existing === undefined) {
    reply.header('Set-Cookie', cookieValue);
    return;
  }

  if (Array.isArray(existing)) {
    reply.header('Set-Cookie', [...existing.map(String), cookieValue]);
    return;
  }

  reply.header('Set-Cookie', [String(existing), cookieValue]);
};
