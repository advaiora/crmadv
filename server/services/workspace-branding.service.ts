import { badRequest } from '../core/errors.js';
import { brandingRepository } from '../repositories/branding.repository.js';

const HEX_COLOR_REGEX = /^#[A-Fa-f0-9]{6}$/;
const DATA_IMAGE_URL_REGEX = /^data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_COMPANY_NAME_LENGTH = 80;
const MAX_LOGO_URL_LENGTH = 2048;
const MAX_LOGO_DATA_URL_LENGTH = 2_800_000;
const MAX_SUPPORT_EMAIL_LENGTH = 320;
const DEFAULT_PRIMARY_COLOR = '#000000';
const DEFAULT_SECONDARY_COLOR = '#ffffff';

type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
};

type BrandingPayload = {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyName: string | null;
  supportEmail: string | null;
};

type BrandingChanges = Partial<{
  logoUrl: { from: string | null; to: string | null };
  primaryColor: { from: string; to: string };
  secondaryColor: { from: string; to: string };
  companyName: { from: string | null; to: string | null };
  supportEmail: { from: string | null; to: string | null };
}>;

type BrandingUpdateInput = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  companyName?: string | null;
  supportEmail?: string | null;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isValidHexColor = (value: string) => HEX_COLOR_REGEX.test(value);

const isValidEmail = (value: string) => EMAIL_REGEX.test(value);

const mapBrandingRecord = (record: {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  workspaceName: string | null;
  supportEmail: string | null;
}): BrandingPayload => ({
  logoUrl: record.logoUrl,
  primaryColor: record.primaryColor,
  secondaryColor: record.secondaryColor,
  accentColor: record.secondaryColor,
  companyName: record.workspaceName,
  supportEmail: record.supportEmail,
});

export const workspaceBrandingService = {
  async getWorkspaceBranding(workspace: WorkspaceRecord) {
    const existingBranding = await brandingRepository.findByWorkspaceId(workspace.id);
    if (existingBranding) {
      return mapBrandingRecord(existingBranding);
    }

    const createdBranding = await brandingRepository.upsertByWorkspaceId(workspace.id, {
      workspaceName: workspace.name,
      logoUrl: null,
      supportEmail: null,
      primaryColor: DEFAULT_PRIMARY_COLOR,
      secondaryColor: DEFAULT_SECONDARY_COLOR,
    });

    return mapBrandingRecord(createdBranding);
  },

  parseUpdateInput(body: unknown): BrandingUpdateInput {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    const allowedKeys = new Set([
      'logoUrl',
      'primaryColor',
      'secondaryColor',
      'accentColor',
      'companyName',
      'supportEmail',
    ]);
    const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
      throw badRequest('Unknown branding fields in body', {
        unknownKeys,
      });
    }

    const parsedInput: BrandingUpdateInput = {};

    if ('logoUrl' in body) {
      const value = body.logoUrl;

      if (value === null) {
        parsedInput.logoUrl = null;
      } else if (typeof value === 'string') {
        const normalized = value.trim();
        if (!normalized) {
          throw badRequest('logoUrl cannot be empty');
        }

        if (normalized.startsWith('data:image/')) {
          if (!DATA_IMAGE_URL_REGEX.test(normalized)) {
            throw badRequest('logoUrl data URI must be a valid base64 image');
          }
          if (normalized.length > MAX_LOGO_DATA_URL_LENGTH) {
            throw badRequest('logoUrl data URI is too long', {
              maxLength: MAX_LOGO_DATA_URL_LENGTH,
            });
          }

          parsedInput.logoUrl = normalized;
        }

        if (!normalized.startsWith('data:image/')) {
          if (normalized.length > MAX_LOGO_URL_LENGTH) {
            throw badRequest('logoUrl is too long', {
              maxLength: MAX_LOGO_URL_LENGTH,
            });
          }

          let parsedUrl: URL;
          try {
            parsedUrl = new URL(normalized);
          } catch {
            throw badRequest('logoUrl must be a valid URL');
          }
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw badRequest('logoUrl must use http or https');
          }

          parsedInput.logoUrl = normalized;
        }
      } else {
        throw badRequest('logoUrl must be a string or null');
      }
    }

    if ('primaryColor' in body) {
      const value = body.primaryColor;
      if (value === null) {
        parsedInput.primaryColor = null;
      } else if (typeof value === 'string') {
        const normalized = value.trim();
        if (!isValidHexColor(normalized)) {
          throw badRequest('primaryColor must be a valid hex color (#RRGGBB)');
        }
        parsedInput.primaryColor = normalized;
      } else {
        throw badRequest('primaryColor must be a string or null');
      }
    }

    const parseSecondaryColorField = (
      value: unknown,
      fieldName: 'secondaryColor' | 'accentColor',
    ): string | null => {
      if (value === null) {
        return null;
      }
      if (typeof value !== 'string') {
        throw badRequest(`${fieldName} must be a string or null`);
      }

      const normalized = value.trim();
      if (!isValidHexColor(normalized)) {
        throw badRequest(`${fieldName} must be a valid hex color (#RRGGBB)`);
      }

      return normalized;
    };

    let parsedSecondaryColor: string | null | undefined;
    if ('secondaryColor' in body) {
      parsedSecondaryColor = parseSecondaryColorField(body.secondaryColor, 'secondaryColor');
    }

    if ('accentColor' in body) {
      const parsedLegacyAccentColor = parseSecondaryColorField(body.accentColor, 'accentColor');

      if (
        parsedSecondaryColor !== undefined &&
        parsedLegacyAccentColor !== undefined &&
        parsedSecondaryColor !== parsedLegacyAccentColor
      ) {
        throw badRequest('secondaryColor and accentColor must match when both are provided');
      }

      if (parsedSecondaryColor === undefined) {
        parsedSecondaryColor = parsedLegacyAccentColor;
      }
    }

    if (parsedSecondaryColor !== undefined) {
      parsedInput.secondaryColor = parsedSecondaryColor;
    }

    if ('companyName' in body) {
      const value = body.companyName;
      if (value === null) {
        parsedInput.companyName = null;
      } else if (typeof value === 'string') {
        const normalized = value.trim();
        if (!normalized) {
          throw badRequest('companyName cannot be empty');
        }
        if (normalized.length > MAX_COMPANY_NAME_LENGTH) {
          throw badRequest('companyName is too long', {
            maxLength: MAX_COMPANY_NAME_LENGTH,
          });
        }

        parsedInput.companyName = normalized;
      } else {
        throw badRequest('companyName must be a string or null');
      }
    }

    if ('supportEmail' in body) {
      const value = body.supportEmail;
      if (value === null) {
        parsedInput.supportEmail = null;
      } else if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
          throw badRequest('supportEmail cannot be empty');
        }
        if (normalized.length > MAX_SUPPORT_EMAIL_LENGTH) {
          throw badRequest('supportEmail is too long', {
            maxLength: MAX_SUPPORT_EMAIL_LENGTH,
          });
        }
        if (!isValidEmail(normalized)) {
          throw badRequest('supportEmail must be a valid email');
        }

        parsedInput.supportEmail = normalized;
      } else {
        throw badRequest('supportEmail must be a string or null');
      }
    }

    if (Object.keys(parsedInput).length === 0) {
      throw badRequest('At least one branding field is required');
    }

    return parsedInput;
  },

  async updateWorkspaceBranding(workspace: WorkspaceRecord, body: unknown) {
    const updates = this.parseUpdateInput(body);

    const currentRecord = await brandingRepository.findByWorkspaceId(workspace.id);
    const previousState: BrandingPayload = currentRecord
      ? mapBrandingRecord(currentRecord)
        : {
          logoUrl: null,
          primaryColor: DEFAULT_PRIMARY_COLOR,
          secondaryColor: DEFAULT_SECONDARY_COLOR,
          accentColor: DEFAULT_SECONDARY_COLOR,
          companyName: workspace.name,
          supportEmail: null,
        };

    const upsertedRecord = await brandingRepository.upsertByWorkspaceId(workspace.id, {
      workspaceName:
        updates.companyName !== undefined ? updates.companyName : previousState.companyName,
      logoUrl: updates.logoUrl !== undefined ? updates.logoUrl : previousState.logoUrl,
      supportEmail:
        updates.supportEmail !== undefined ? updates.supportEmail : previousState.supportEmail,
      primaryColor:
        updates.primaryColor !== undefined
          ? (updates.primaryColor ?? DEFAULT_PRIMARY_COLOR)
          : previousState.primaryColor,
      secondaryColor:
        updates.secondaryColor !== undefined
          ? (updates.secondaryColor ?? DEFAULT_SECONDARY_COLOR)
          : previousState.secondaryColor,
    });

    const nextState = mapBrandingRecord(upsertedRecord);

    const changes: BrandingChanges = {};
    if (previousState.logoUrl !== nextState.logoUrl) {
      changes.logoUrl = { from: previousState.logoUrl, to: nextState.logoUrl };
    }
    if (previousState.primaryColor !== nextState.primaryColor) {
      changes.primaryColor = { from: previousState.primaryColor, to: nextState.primaryColor };
    }
    if (previousState.secondaryColor !== nextState.secondaryColor) {
      changes.secondaryColor = { from: previousState.secondaryColor, to: nextState.secondaryColor };
    }
    if (previousState.companyName !== nextState.companyName) {
      changes.companyName = { from: previousState.companyName, to: nextState.companyName };
    }
    if (previousState.supportEmail !== nextState.supportEmail) {
      changes.supportEmail = { from: previousState.supportEmail, to: nextState.supportEmail };
    }

    return {
      branding: nextState,
      changes,
    };
  },
};
