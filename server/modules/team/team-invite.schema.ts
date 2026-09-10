import { z } from 'zod';

export const DEFAULT_INVITE_EXPIRES_IN_DAYS = 7;
export const MAX_INVITE_EXPIRES_IN_DAYS = 30;

export const createInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  rolePreset: z
    .union([
      z.string().trim().min(1),
      z.array(z.string().trim().min(1)).min(1),
    ])
    .optional(),
  expiresInDays: z
    .number()
    .int()
    .min(1)
    .max(MAX_INVITE_EXPIRES_IN_DAYS)
    .optional(),
}).strict();

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(32),
}).strict();

export type InviteRolePresetInput = z.infer<typeof createInviteSchema>['rolePreset'];