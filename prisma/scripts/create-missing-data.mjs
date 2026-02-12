import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PRIMARY_WORKSPACE_ID = 'cmljchaw90000hjagt0yqk7cu';
const SUPERADMIN_USER_ID = 'cmljchaxc0001hjagiy7byfne';
const LIMITED_USER_ID = 'cmljchaxk0002hjage55aantp';

const buildUniqueSlug = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `other-demo-${timestamp}-${random}`;
};

const main = async () => {
  const slug = buildUniqueSlug();

  const result = await prisma.$transaction(async (tx) => {
    const otherWorkspace = await tx.workspace.create({
      data: {
        name: 'Other Demo',
        slug,
      },
      select: {
        id: true,
      },
    });

    await tx.membership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: otherWorkspace.id,
          userId: SUPERADMIN_USER_ID,
        },
      },
      update: {
        status: 'active',
      },
      create: {
        workspaceId: otherWorkspace.id,
        userId: SUPERADMIN_USER_ID,
        status: 'active',
      },
    });

    await tx.membership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: otherWorkspace.id,
          userId: LIMITED_USER_ID,
        },
      },
      update: {
        status: 'active',
      },
      create: {
        workspaceId: otherWorkspace.id,
        userId: LIMITED_USER_ID,
        status: 'active',
      },
    });

    const maxSortOrder = await tx.pipelineStage.aggregate({
      where: {
        workspaceId: PRIMARY_WORKSPACE_ID,
      },
      _max: {
        sortOrder: true,
      },
    });

    const pipelineStage = await tx.pipelineStage.create({
      data: {
        workspaceId: PRIMARY_WORKSPACE_ID,
        name: `Non Gated Stage ${new Date().toISOString()}`,
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
        isGated: false,
        gateChecklistTemplateId: null,
      },
      select: {
        id: true,
      },
    });

    return {
      otherWorkspaceId: otherWorkspace.id,
      pipelineStageId: pipelineStage.id,
    };
  });

  console.log(`otherWorkspaceId=${result.otherWorkspaceId}`);
  console.log(`pipelineStageId=${result.pipelineStageId}`);
};

main()
  .catch((error) => {
    console.error('Script failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
