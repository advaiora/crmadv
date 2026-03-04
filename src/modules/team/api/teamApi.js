import { apiGet, apiPatch, apiPost } from '../../../utils/apiClient';

const TEAM_API_BASE = '/api/team';

export const listTeamMembers = () => apiGet(TEAM_API_BASE);

export const getTeamMember = (memberId) => apiGet(`${TEAM_API_BASE}/${memberId}`);

export const updateTeamMember = (memberId, payload = {}) =>
  apiPatch(`${TEAM_API_BASE}/${memberId}`, payload);

export const createTeamMember = (payload) =>
  apiPost(TEAM_API_BASE, payload);

export const createTeamInvite = (payload) => apiPost(`${TEAM_API_BASE}/invites`, payload);

export const listTeamInvites = () => apiGet(`${TEAM_API_BASE}/invites`);

export const revokeTeamInvite = (inviteId) =>
  apiPost(`${TEAM_API_BASE}/invites/${inviteId}/revoke`, {});

export const deleteTeamInvite = (inviteId) =>
  apiPost(`${TEAM_API_BASE}/invites/${inviteId}/delete`, {});

export const setTeamMemberActiveState = (memberId, active) =>
  apiPost(`${TEAM_API_BASE}/${memberId}/deactivate`, {
    active: Boolean(active),
  });

export const assignTeamMemberRole = (memberId, roleName) =>
  apiPost(`${TEAM_API_BASE}/${memberId}/roles`, {
    roleNames: [roleName],
  });

export const deleteTeamMember = (memberId) =>
  apiPost(`${TEAM_API_BASE}/${memberId}/remove`, {});
