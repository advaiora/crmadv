import { prisma } from '../prisma.js';

const brandingSelect = {
  workspaceId: true,
  workspaceName: true,
  logoUrl: true,
  supportEmail: true,
  supportPhone: true,
  supportAddress: true,
  pdfSignatureUrl: true,
  primaryColor: true,
  secondaryColor: true,
} as const;

export type WorkspaceBrandingRecord = Awaited<
  ReturnType<typeof brandingRepository.findByWorkspaceId>
>;

type UpsertWorkspaceBrandingInput = {
  workspaceName: string | null;
  logoUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  supportAddress: string | null;
  pdfSignatureUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

export const brandingRepository = {
  findByWorkspaceId(workspaceId: string) {
    return prisma.workspaceBranding.findUnique({
      where: {
        workspaceId,
      },
      select: brandingSelect,
    });
  },

  upsertByWorkspaceId(workspaceId: string, input: UpsertWorkspaceBrandingInput) {
    return prisma.workspaceBranding.upsert({
      where: {
        workspaceId,
      },
      update: {
        workspaceName: input.workspaceName,
        logoUrl: input.logoUrl,
        supportEmail: input.supportEmail,
        supportPhone: input.supportPhone,
        supportAddress: input.supportAddress,
        pdfSignatureUrl: input.pdfSignatureUrl,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
      },
      create: {
        workspaceId,
        workspaceName: input.workspaceName,
        logoUrl: input.logoUrl,
        supportEmail: input.supportEmail,
        supportPhone: input.supportPhone,
        supportAddress: input.supportAddress,
        pdfSignatureUrl: input.pdfSignatureUrl,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
      },
      select: brandingSelect,
    });
  },
};
