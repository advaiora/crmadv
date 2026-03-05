import assert from 'node:assert/strict';
import test from 'node:test';
import { isHttpError } from '../../core/errors.js';
import { checklistsRepository } from './checklists.repository.js';
import { checklistsService, checklistsServiceRuntime } from './checklists.service.js';

test('projects.move_stage gate returns GATE_BLOCKED with missing items when required checklist items are incomplete', async (t) => {
  t.mock.method(checklistsServiceRuntime, 'runTransaction', async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({}),
  );

  t.mock.method(checklistsRepository, 'listEnabledStageChecklistRules', async () => ([
    {
      id: 'rule-1',
      workspaceId: 'workspace-1',
      projectCategoryId: 'category-1',
      pipelineStageId: 'stage-2',
      checklistTemplateId: 'template-1',
      gateEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      checklistTemplate: {
        id: 'template-1',
        name: 'Go-live checklist',
        appliesTo: 'PROJECT_STAGE',
        isArchived: false,
      },
    },
  ] as never));

  t.mock.method(checklistsRepository, 'findActiveTemplateById', async () => ({
    id: 'template-1',
    workspaceId: 'workspace-1',
    appliesTo: 'PROJECT_STAGE',
    isArchived: false,
  } as never));

  t.mock.method(checklistsRepository, 'findChecklistInstanceByUnique', async () => ({
    id: 'instance-1',
  } as never));

  t.mock.method(checklistsRepository, 'listMissingRequiredItemIds', async () => ['item-1', 'item-2']);

  await assert.rejects(
    async () =>
      checklistsService.enforceGateForStageTransition({
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        toStageId: 'stage-2',
        overrideGate: false,
        overrideReason: null,
        actorUserId: 'user-1',
        stageConfig: {
          categoryId: 'category-1',
          isGated: false,
          gateChecklistTemplateId: null,
          autoCreateInstance: true,
        },
      }),
    (error) => {
      assert.equal(isHttpError(error), true);
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'GATE_BLOCKED');
      assert.equal(Array.isArray((error.details as { missingItems?: unknown[] } | undefined)?.missingItems), true);
      return true;
    },
  );
});

test('assignChecklistItem rejects assignee outside workspace', async (t) => {
  t.mock.method(checklistsRepository, 'findChecklistInstanceItemById', async () => ({
    id: 'item-1',
    instanceId: 'instance-1',
    workspaceId: 'workspace-1',
    templateItemId: 'template-item-1',
    titleSnapshot: 'Task',
    isRequiredSnapshot: true,
    requiresEvidenceSnapshot: false,
    isCriticalSnapshot: false,
    sortOrderSnapshot: 0,
    state: 'pending',
    evidenceNote: null,
    evidenceUrl: null,
    notApplicableReason: null,
    completedAt: null,
    completedByUserId: null,
    assignedToUserId: null,
    assignedByUserId: null,
    assignedAt: null,
    assignedToUser: null,
    assignedByUser: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    instance: {
      id: 'instance-1',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
      pipelineStageId: 'stage-1',
      checklistTemplateId: 'template-1',
      status: 'active',
    },
  } as never));

  t.mock.method(checklistsRepository, 'findActiveWorkspaceMemberByUserId', async () => null);

  await assert.rejects(
    async () => checklistsService.assignChecklistItem({
      workspaceId: 'workspace-1',
      itemId: 'item-1',
      actorUserId: 'actor-1',
      body: {
        assignedToUserId: 'user-outside-workspace',
      },
    }),
    (error) => {
      assert.equal(isHttpError(error), true);
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});
