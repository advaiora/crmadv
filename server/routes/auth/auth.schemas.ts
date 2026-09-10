// Schemi di validazione delle rotte di autenticazione.
// Validazione pura: nessuna dipendenza da Prisma ne' da Fastify, quindi si puo'
// importare da qualsiasi punto senza trascinarsi dietro il resto del server.

import { z } from 'zod';
import {
  normalizeWorkspaceSystemRoleName,
  REGISTRABLE_WORKSPACE_ROLE_NAMES,
} from '../../auth/workspace-bootstrap.js';
import {
  EXISTING_PASSWORD_MIN_LENGTH as LOGIN_MIN_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../../auth/password-policy.js';

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isLikelyJwtToken = (value: string) => value.split('.').length === 3;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(LOGIN_MIN_PASSWORD_LENGTH),
});

export const registerSchema = z.object({
  name: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (typeof value !== 'string') {
        return null;
      }

      const normalizedName = value.trim();
      return normalizedName.length > 0 ? normalizedName : null;
    }),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  workspaceName: z.string().trim().min(1),
  workspaceSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .regex(slugPattern, 'Workspace slug non valido'),
  role: z.enum(REGISTRABLE_WORKSPACE_ROLE_NAMES).optional(),
});

export const updateMeSchema = z
  .object({
    name: z
      .preprocess(
        (value) => {
          if (value === undefined || value === null) {
            return value;
          }

          if (typeof value !== 'string') {
            return value;
          }

          const normalized = value.trim();
          return normalized.length > 0 ? normalized : null;
        },
        z.union([z.string().max(120), z.null()]).optional(),
      )
      .optional(),
    email: z
      .preprocess(
        (value) => {
          if (value === undefined) {
            return undefined;
          }

          if (typeof value !== 'string') {
            return value;
          }

          const normalized = value.trim().toLowerCase();
          return normalized.length > 0 ? normalized : value;
        },
        z.string().email().optional(),
      )
      .optional(),
    themePreference: z
      .union([z.enum(['light', 'dark', 'system']), z.null()])
      .optional(),
    avatarUrl: z
      .preprocess(
        (value) => {
          if (value === undefined) {
            return undefined;
          }
          if (value === null) {
            return null;
          }
          if (typeof value !== 'string') {
            return value;
          }
          const normalized = value.trim();
          return normalized.length > 0 ? normalized : null;
        },
        z
          .union([
            z
              .string()
              .max(1_000_000, 'Immagine profilo troppo grande')
              .refine(
                (value) =>
                  value.startsWith('data:image/')
                  || value.startsWith('http://')
                  || value.startsWith('https://'),
                'avatarUrl deve essere un data:image o un URL http(s)',
              ),
            z.null(),
          ])
          .optional(),
      )
      .optional(),
  })
  .superRefine((value, context) => {
    if (
      value.name === undefined
      && value.email === undefined
      && value.themePreference === undefined
      && value.avatarUrl === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field is required',
        path: ['name'],
      });
    }
  });

export const googleAuthSchema = z.object({
  idToken: z.string().trim().min(1).optional(),
  credential: z.string().trim().min(1).optional(),
  id_token: z.string().trim().min(1).optional(),
  token: z.string().trim().min(1).optional(),
  googleIdToken: z.string().trim().min(1).optional(),
  accessToken: z.string().trim().min(1).optional(),
  access_token: z.string().trim().min(1).optional(),
  googleAccessToken: z.string().trim().min(1).optional(),
  mode: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : undefined),
    z.enum(['login', 'signup']).optional(),
  ),
  action: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : undefined),
    z.enum(['login', 'signup']).optional(),
  ),
  workspaceName: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const normalized = value.trim();
      return normalized.length > 0 ? normalized : undefined;
    },
    z.string().min(1).optional(),
  ),
  workspaceSlug: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return undefined;
      }

      const normalized = value.trim().toLowerCase();
      return normalized.length > 0 ? normalized : undefined;
    },
    z.string().regex(slugPattern, 'Workspace slug non valido').optional(),
  ),
  role: z.preprocess(
    (value) => normalizeWorkspaceSystemRoleName(value),
    z.enum(REGISTRABLE_WORKSPACE_ROLE_NAMES).nullable().optional(),
  ),
})
  .superRefine((value, context) => {
    if (
      !value.idToken
      && !value.credential
      && !value.id_token
      && !value.token
      && !value.googleIdToken
      && !value.accessToken
      && !value.access_token
      && !value.googleAccessToken
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'idToken/credential/accessToken is required',
        path: ['idToken'],
      });
    }
  })
  .transform((value) => {
    const genericToken = value.token ?? '';
    const idToken = value.idToken
      ?? value.credential
      ?? value.id_token
      ?? value.googleIdToken
      ?? (genericToken && isLikelyJwtToken(genericToken) ? genericToken : '');
    const accessToken = value.accessToken
      ?? value.access_token
      ?? value.googleAccessToken
      ?? (genericToken && !isLikelyJwtToken(genericToken) ? genericToken : '');

    return {
      ...value,
      mode: value.mode ?? value.action,
      idToken,
      accessToken,
    };
  });

export type ParsedGoogleAuthPayload = z.infer<typeof googleAuthSchema>;
