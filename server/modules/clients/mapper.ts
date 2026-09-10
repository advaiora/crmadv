import type { ClientSortDirection, ClientSortField } from './repository.js';
import type { ClientProjectRecord, ClientRecord, MapClientOptions } from './types.js';

export const arraysAreEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const sortUniqueFields = (fields: string[]) => Array.from(new Set(fields)).sort();

export const mapClientProject = (project: ClientProjectRecord) => ({
  id: project.id,
  workspaceId: project.workspaceId,
  clientId: project.clientId,
  name: project.name,
  categoryId: project.pipelineStage?.categoryId ?? null,
  stageId: project.pipelineStageId,
  pipelineStageId: project.pipelineStageId,
  stage: project.pipelineStage
    ? {
        id: project.pipelineStage.id,
        categoryId: project.pipelineStage.categoryId,
        name: project.pipelineStage.name,
        sortOrder: project.pipelineStage.sortOrder,
        isClosed: project.pipelineStage.isClosed,
        color: project.pipelineStage.color,
      }
    : null,
  categoryName: project.pipelineStage?.category?.name ?? null,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

export const mapClient = (record: ClientRecord, options: MapClientOptions = {}) => ({
  id: record.id,
  workspaceId: record.workspaceId,
  type: record.type,
  name: record.name,
  email: record.email,
  phone: record.phone,
  vatNumber: record.vatNumber,
  taxCode: record.taxCode,
  address: {
    street: record.street,
    city: record.city,
    zip: record.zip,
    province: record.province,
    country: record.country,
  },
  notes: record.notes,
  tags: record.tags,
  customFields: (record.customFields ?? {}) as Record<string, unknown>,
  ...(options.includeProjects
    ? {
        projects: (options.projects ?? []).map((project) => mapClientProject(project)),
      }
    : {}),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const mapSortToken = (sortField: ClientSortField, sortDirection: ClientSortDirection) =>
  sortDirection === 'desc' ? `-${sortField}` : sortField;
