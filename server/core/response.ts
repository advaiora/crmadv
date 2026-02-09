import type { FastifyReply } from 'fastify';
import type { ErrorDetails } from './errors.js';

type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
};

type SuccessPayload<T> = {
  data: T;
};

export const ok = <T>(reply: FastifyReply, data: T, statusCode = 200) =>
  reply.code(statusCode).send({ data } satisfies SuccessPayload<T>);

export const fail = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: ErrorDetails,
) =>
  reply
    .code(statusCode)
    .send({ error: { code, message, ...(details !== undefined ? { details } : {}) } } satisfies ErrorPayload);
