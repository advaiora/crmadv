import { badRequest, notFound } from '../core/errors.js';
import { departmentRepository } from '../repositories/department.repository.js';

const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 280;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

type DepartmentPayload = {
  name: string;
  description: string | null;
};

export const workspaceDepartmentsService = {
  listDepartments(workspaceId: string) {
    return departmentRepository.listDepartments(workspaceId);
  },

  parseDepartmentPayload(body: unknown): DepartmentPayload {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw badRequest('Department name is required');
    }

    const name = body.name.trim();
    if (name.length > MAX_NAME_LENGTH) {
      throw badRequest('Department name is too long', { maxLength: MAX_NAME_LENGTH });
    }

    let description: string | null = null;
    if (body.description !== undefined && body.description !== null) {
      if (typeof body.description !== 'string') {
        throw badRequest('Description must be a string');
      }
      const trimmed = body.description.trim();
      if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
        throw badRequest('Description is too long', { maxLength: MAX_DESCRIPTION_LENGTH });
      }
      description = trimmed ? trimmed : null;
    }

    return { name, description };
  },

  async createDepartment(workspaceId: string, body: unknown) {
    const payload = this.parseDepartmentPayload(body);

    const existing = await departmentRepository.findByName(workspaceId, payload.name);
    if (existing) {
      throw badRequest('Department name already exists in workspace', { name: payload.name });
    }

    const department = await departmentRepository.create(
      workspaceId,
      payload.name,
      payload.description,
    );

    return { department };
  },

  async updateDepartment(workspaceId: string, departmentId: string, body: unknown) {
    const existing = await departmentRepository.findById(workspaceId, departmentId);
    if (!existing) {
      throw notFound('Department not found');
    }

    const payload = this.parseDepartmentPayload(body);

    const sameName = await departmentRepository.findByName(workspaceId, payload.name);
    if (sameName && sameName.id !== departmentId) {
      throw badRequest('Department name already exists in workspace', { name: payload.name });
    }

    const department = await departmentRepository.update(
      workspaceId,
      departmentId,
      payload.name,
      payload.description,
    );

    return { department };
  },

  async deleteDepartment(workspaceId: string, departmentId: string) {
    const existing = await departmentRepository.findById(workspaceId, departmentId);
    if (!existing) {
      throw notFound('Department not found');
    }

    await departmentRepository.delete(workspaceId, departmentId);

    return { department: { id: existing.id, name: existing.name } };
  },

  async getDepartmentMembers(workspaceId: string, departmentId: string) {
    const existing = await departmentRepository.findById(workspaceId, departmentId);
    if (!existing) {
      throw notFound('Department not found');
    }

    const members = await departmentRepository.listMembers(workspaceId, departmentId);
    return { departmentId, members };
  },

  parseMemberUserIds(body: unknown): string[] {
    if (!isObject(body)) {
      throw badRequest('Body must be a JSON object');
    }

    if (!Array.isArray(body.userIds)) {
      throw badRequest('userIds must be an array');
    }

    return body.userIds.map((value, index) => {
      if (typeof value !== 'string' || !value.trim()) {
        throw badRequest(`userIds[${index}] must be a non-empty string`);
      }

      return value.trim();
    });
  },

  // Replace the department's members. Passing an empty array clears all members.
  async assignMembers(workspaceId: string, departmentId: string, body: unknown) {
    const requestedUserIds = Array.from(new Set(this.parseMemberUserIds(body)));

    const department = await departmentRepository.findById(workspaceId, departmentId);
    if (!department) {
      throw notFound('Department not found');
    }

    if (requestedUserIds.length > 0) {
      const activeUserIds = new Set(
        await departmentRepository.listActiveWorkspaceMemberUserIds(workspaceId),
      );
      const invalidUserIds = requestedUserIds.filter((userId) => !activeUserIds.has(userId));
      if (invalidUserIds.length > 0) {
        throw badRequest('Some users are not active members of the workspace', {
          invalidUserIds: invalidUserIds.sort(),
        });
      }
    }

    const previousUserIds = await departmentRepository.listMemberUserIds(workspaceId, departmentId);
    await departmentRepository.replaceMembers(workspaceId, departmentId, requestedUserIds);
    const members = await departmentRepository.listMembers(workspaceId, departmentId);

    return {
      departmentId,
      members,
      changes: {
        from: [...previousUserIds].sort(),
        to: [...requestedUserIds].sort(),
      },
    };
  },
};
