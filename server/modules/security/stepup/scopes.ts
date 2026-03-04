export const stepUpScopes = {
  vaultReveal: 'vault:reveal',
} as const;

export type StepUpScope = (typeof stepUpScopes)[keyof typeof stepUpScopes];

export const stepUpPurposes = ['vault.reveal'] as const;

export type StepUpPurpose = (typeof stepUpPurposes)[number];

export const stepUpPurposeToScope: Record<StepUpPurpose, StepUpScope> = {
  'vault.reveal': stepUpScopes.vaultReveal,
};
