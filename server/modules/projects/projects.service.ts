import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { audit } from '../../audit/audit.js';
import { badRequest, notFound } from '../../core/errors.js';
import { checklistsService } from '../checklists/checklists.service.js';
import { projectsRepository } from './projects.repository.js';

const MIN_OVERRIDE_REASON_LENGTH = 10;

const idSchema = z.string().trim().min(1);

const moveStageBodySchema = z
  .object({
    toStageId: idSchema,
    overrideGate: z.boolean().optional().default(false),
    overrideReason: z.string().trim().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.overrideGate) {
      return;
    }

    const reason = value.overrideReason?.trim() ?? '';
    if (reason.length < MIN_OVERRIDE_REASON_LENGTH) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['overrideReason'],
        message: `overrideReason must be at least ${MIN_OVERRIDE_REASON_LENGTH} characters`,
      });
    }
  });

const parseWithSchema = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  message: string,
): z.infer<TSchema> => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw badRequest(message, {
      issues: parsed.error.flatten(),
    });
  }

  return parsed.data;
};

export type MoveProjectStagePayload = {
  toStageId: string;
  overrideGate: boolean;
  overrideReason: string | null;
};

export const projectsService = {
  parseProjectId(rawProjectId: string) {
    return parseWithSchema(idSchema, rawProjectId, 'Project id is invalid');
  },

  parseMoveStageBody(body: unknown): MoveProjectStagePayload {
    const parsed = parseWithSchema(
      moveStageBodySchema,
      body,
      'Invalid move-stage payload',
    );

    return {
      toStageId: parsed.toStageId,
      overrideGate: parsed.overrideGate,
      overrideReason: parsed.overrideReason?.trim() ?? null,
    };
  },

  async moveStage(input: {
    workspaceId: string;
    actorUserId: string;
    projectId: string;
    payload: MoveProjectStagePayload;
    request: FastifyRequest;
  }) {
    const schemaReady = await projectsRepository.isMoveStageSchemaReady();
    if (!schemaReady) {
      throw badRequest('Projects move-stage schema is not available', {
        requiredTables: ['Project', 'PipelineStage'],
        requiredColumns: {
          Project: ['id', 'workspaceId', 'pipelineStageId'],
          PipelineStage: ['id', 'workspaceId'],
        },
      });
    }

    const projectId = this.parseProjectId(input.projectId);
    const payload = input.payload;

    const stageExists = await projectsRepository.stageExistsInWorkspace(
      input.workspaceId,
      payload.toStageId,
    );
    if (!stageExists) {
      throw notFound('Pipeline stage not found');
    }

    const project = await projectsRepository.findProjectById(input.workspaceId, projectId);
    if (!project) {
      throw notFound('Project not found');
    }

    // Transaction choice (MVP): gate instance auto-create/validation and stage update
    // are executed as sequential guarded operations across module boundaries.
    // Unique constraints + optimistic checks keep the flow concurrency-safe.
    const gate = await checklistsService.enforceGateForStageTransition({
      workspaceId: input.workspaceId,
      projectId,
      toStageId: payload.toStageId,
      overrideGate: payload.overrideGate,
      overrideReason: payload.overrideReason,
      actorUserId: input.actorUserId,
      request: input.request,
    });

    const movedProject = await projectsRepository.moveProjectToStage(
      input.workspaceId,
      projectId,
      payload.toStageId,
    );
    if (!movedProject) {
      throw notFound('Project not found');
    }

    await audit.log({
      event: 'projects.move_stage',
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: 'Project',
      entityId: projectId,
      metadata: {
        projectId,
        fromStageId: project.pipelineStageId,
        toStageId: movedProject.pipelineStageId,
        gateEnforced: gate.enforced,
        gateOverridden: gate.overridden,
        gateRuleId: gate.ruleId,
        checklistInstanceId: gate.checklistInstanceId,
        missingRequiredItemIds: gate.missingRequiredItemIds,
      },
      request: input.request,
    });

    return {
      project: {
        id: movedProject.id,
        workspaceId: movedProject.workspaceId,
        pipelineStageId: movedProject.pipelineStageId,
        previousPipelineStageId: project.pipelineStageId,
      },
      gate: {
        enforced: gate.enforced,
        overridden: gate.overridden,
        ruleId: gate.ruleId,
        checklistInstanceId: gate.checklistInstanceId,
      },
    };
  },
};
