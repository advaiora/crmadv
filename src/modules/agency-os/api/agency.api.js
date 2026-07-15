import { apiFetch } from "../../../lib/apiFetch";
import { getDevAuthHeaders } from "../../../utils/devAuthSession";

export class AgencyApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "AgencyApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const parseJsonSafe = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new AgencyApiError("Agency API response is not valid JSON", {
      status: response.status,
      code: "INVALID_JSON_RESPONSE",
      details: { text },
    });
  }
};

const mapStatusToCode = (status) => {
  if (status === 400) {
    return "BAD_REQUEST";
  }
  if (status === 401) {
    return "UNAUTHORIZED";
  }
  if (status === 403) {
    return "FORBIDDEN";
  }
  if (status === 404) {
    return "NOT_FOUND";
  }
  if (status === 409) {
    return "CONFLICT";
  }
  return "API_ERROR";
};

export const agencyFetch = async (path, { method = "GET", headers = {}, body, signal } = {}) => {
  const authHeaders = getDevAuthHeaders();
  const isFormDataBody = body instanceof FormData;

  if (!authHeaders.Authorization) {
    throw new AgencyApiError("Sessione non disponibile. Effettua il login.", {
      status: 401,
      code: "UNAUTHORIZED",
    });
  }

  const response = await apiFetch(path, {
    method,
    signal,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && !isFormDataBody ? { "Content-Type": "application/json" } : {}),
      ...authHeaders,
      ...headers,
    },
    ...(body !== undefined
      ? {
          body: isFormDataBody ? body : JSON.stringify(body),
        }
      : {}),
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new AgencyApiError(
      payload?.error?.message || `Agency request failed with status ${response.status}`,
      {
        status: response.status,
        code: payload?.error?.code || mapStatusToCode(response.status),
        details: payload?.error?.details,
      },
    );
  }

  if (payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data;
  }

  return payload;
};

export const fetchAgencyProjectOverviewSeed = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/overview`, {
    method: "GET",
    signal,
  });

  return result?.overview || null;
};

export const fetchAgencyProjects = async ({ signal } = {}) => {
  const result = await agencyFetch("/agency/projects", {
    method: "GET",
    signal,
  });

  return result?.projects || null;
};

export const createAgencyProject = async (payload, { signal } = {}) => {
  const result = await agencyFetch("/agency/projects", {
    method: "POST",
    body: payload,
    signal,
  });

  return result?.project || null;
};

export const fetchAgencyProject = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}`, {
    method: "GET",
    signal,
  });

  return result?.project || null;
};

export const fetchAgencyProjectBrainSeed = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/brain`, {
    method: "GET",
    signal,
  });

  return result?.brain || null;
};

export const fetchAgencyProjectWorkingContext = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/working-context`, {
    method: "GET",
    signal,
  });

  return result?.workingContext || null;
};

export const fetchAgencyProjectDiscovery = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/discovery`, {
    method: "GET",
    signal,
  });

  return result?.discovery || null;
};

export const regenerateAgencyProjectDiscoveryFromSources = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/discovery/regenerate-from-sources`, {
    method: "POST",
    signal,
  });

  return result?.discovery || null;
};

export const generateAgencyProjectDiscoveryFromSources = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/discovery/generate-from-sources`, {
    method: "POST",
    signal,
  });

  return result?.discovery || null;
};

export const regenerateAgencyProjectDiscoverySectionFromSources = async (projectId, sectionKey, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/discovery/regenerate-section`, {
    method: "POST",
    body: { sectionKey },
    signal,
  });

  return result?.discovery || null;
};

export const generateAgencyProjectDiscoverySection = async (projectId, sectionKey, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/discovery/generate-section`, {
    method: "POST",
    body: { sectionKey },
    signal,
  });

  return result?.discovery || null;
};

export const fetchAgencyProjectSources = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/sources`, {
    method: "GET",
    signal,
  });

  return result?.sources || null;
};

export const saveAgencyProjectSources = async (projectId, payload, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/sources`, {
    method: "PUT",
    body: payload,
    signal,
  });

  return result?.sources || null;
};

export const uploadAgencyProjectSourceFile = async (projectId, file, { signal } = {}) => {
  const formData = new FormData();
  formData.append("file", file);

  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/sources/files`, {
    method: "POST",
    body: formData,
    signal,
  });

  return result?.file || null;
};

export const deleteAgencyProjectSourceFile = async (projectId, fileId, { signal } = {}) => {
  const result = await agencyFetch(
    `/agency/projects/${encodeURIComponent(projectId)}/sources/files/${encodeURIComponent(fileId)}`,
    {
      method: "DELETE",
      signal,
    },
  );

  return result?.sources || null;
};

const parseContentDispositionFilename = (value) => {
  const match = String(value || "").match(/filename="([^"]+)"/i);
  return match?.[1] || "";
};

export const fetchAgencyProjectSourceFileBlob = async (projectId, fileId, { download = false, signal } = {}) => {
  const authHeaders = getDevAuthHeaders();
  if (!authHeaders.Authorization) {
    throw new AgencyApiError("Sessione non disponibile. Effettua il login.", {
      status: 401,
      code: "UNAUTHORIZED",
    });
  }

  const query = download ? "?download=1" : "";
  const response = await apiFetch(
    `/agency/projects/${encodeURIComponent(projectId)}/sources/files/${encodeURIComponent(fileId)}${query}`,
    {
      method: "GET",
      signal,
      headers: {
        Accept: "*/*",
        ...authHeaders,
      },
    },
  );

  if (!response.ok) {
    let message = `Download file non riuscito con status ${response.status}`;
    try {
      const payload = await parseJsonSafe(response);
      message = payload?.error?.message || message;
    } catch (_error) {
      // Keep generic file error.
    }
    throw new AgencyApiError(message, {
      status: response.status,
      code: mapStatusToCode(response.status),
    });
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get("content-type") || "",
    filename: parseContentDispositionFilename(response.headers.get("content-disposition")),
  };
};

export const searchAgencyProjectCompetitors = async (projectId, { dryRun = false, signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/sources/competitors/search`, {
    method: "POST",
    ...(dryRun ? { body: { dryRun: true } } : {}),
    signal,
  });

  return result?.competitorSearch || null;
};

export const fetchAgencyCompetitorSearchSettings = async ({ signal } = {}) => {
  const result = await agencyFetch("/agency/settings/provider-status", {
    method: "GET",
    signal,
  });

  return result?.competitorSearch || null;
};

export const fetchAgencyAiStatus = async ({ signal } = {}) => {
  const result = await agencyFetch("/agency/ai/status", {
    method: "GET",
    signal,
  });

  return result?.ai || null;
};

export const fetchAgencyRuntimeSettings = async ({ signal } = {}) => {
  const result = await agencyFetch("/agency/settings/runtime", {
    method: "GET",
    signal,
  });

  return result?.runtimeSettings || null;
};

export const updateAgencyRuntimeSettings = async (payload, { signal } = {}) => {
  const result = await agencyFetch("/agency/settings/runtime", {
    method: "PUT",
    body: payload,
    signal,
  });

  return result?.runtimeSettings || null;
};

export const fetchAgencyAiUsage = async ({ days = 30, userId, model, functionName, projectId, signal } = {}) => {
  const params = new URLSearchParams({ days: String(days) });
  if (userId) params.set("userId", userId);
  if (model) params.set("model", model);
  if (functionName) params.set("functionName", functionName);
  if (projectId) params.set("projectId", projectId);
  const result = await agencyFetch(`/agency/settings/ai-usage?${params.toString()}`, {
    method: "GET",
    signal,
  });

  return result?.usage || null;
};

export const fetchAgencyChatProjects = async ({ signal } = {}) => {
  const result = await agencyFetch(`/agency/chat/projects`, {
    method: "GET",
    signal,
  });

  return Array.isArray(result?.projects) ? result.projects : [];
};

// --- Allegati della chat (Fase 3a) ---
// L'ambito viaggia come parametro (scope + targetId): le rotte degli allegati sono
// le stesse per progetto, cliente e generale.
const chatScopeQuery = (target) => {
  const params = new URLSearchParams({ scope: target.scope });
  if (target.id) {
    params.set("targetId", target.id);
  }
  return params.toString();
};

export const fetchAgencyChatAttachments = async (target, { signal } = {}) => {
  const result = await agencyFetch(`/agency/chat/attachments?${chatScopeQuery(target)}`, {
    method: "GET",
    signal,
  });

  const list = result?.attachments?.attachments;
  return Array.isArray(list) ? list : [];
};

export const uploadAgencyChatFileAttachment = async (target, file, { signal } = {}) => {
  const form = new FormData();
  form.append("file", file);
  const result = await agencyFetch(`/agency/chat/attachments/file?${chatScopeQuery(target)}`, {
    method: "POST",
    body: form,
    signal,
  });

  return result?.attachment || null;
};

export const addAgencyChatEntityAttachment = async (target, { entityType, entityId }, { signal } = {}) => {
  const result = await agencyFetch(`/agency/chat/attachments/entity`, {
    method: "POST",
    body: { scope: target.scope, targetId: target.id, entityType, entityId },
    signal,
  });

  return result?.attachment || null;
};

export const removeAgencyChatAttachment = async (attachmentId, { signal } = {}) => {
  await agencyFetch(`/agency/chat/attachments/${encodeURIComponent(attachmentId)}`, {
    method: "DELETE",
    signal,
  });

  return true;
};

// --- Chat AI ambito CLIENTE e GENERALE (Fase 2) ---
export const fetchAgencyClientChat = async (clientId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/chat/client/${encodeURIComponent(clientId)}`, {
    method: "GET",
    signal,
  });

  return result?.chat || null;
};

export const sendAgencyClientChatMessage = async (clientId, message, { askAi = false, attachmentIds = [], signal } = {}) => {
  const result = await agencyFetch(`/agency/chat/client/${encodeURIComponent(clientId)}`, {
    method: "POST",
    body: { message, askAi, attachmentIds },
    signal,
  });

  return result?.chat || null;
};

export const fetchAgencyGeneralChat = async ({ signal } = {}) => {
  const result = await agencyFetch(`/agency/chat/general`, {
    method: "GET",
    signal,
  });

  return result?.chat || null;
};

export const sendAgencyGeneralChatMessage = async (message, { askAi = false, attachmentIds = [], signal } = {}) => {
  const result = await agencyFetch(`/agency/chat/general`, {
    method: "POST",
    body: { message, askAi, attachmentIds },
    signal,
  });

  return result?.chat || null;
};

export const fetchAgencyProjectChat = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/chat`, {
    method: "GET",
    signal,
  });

  return result?.chat || null;
};

export const sendAgencyProjectChatMessage = async (projectId, message, { askAi = false, attachmentIds = [], signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/chat`, {
    method: "POST",
    body: { message, askAi, attachmentIds },
    signal,
  });

  return result?.chat || null;
};

export const clearAgencyProjectChat = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/chat`, {
    method: "DELETE",
    signal,
  });

  return result?.chat || null;
};

export const fetchAgencyProjectChatParticipants = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/chat/participants`, {
    method: "GET",
    signal,
  });

  return result?.participants || null;
};

export const addAgencyProjectChatParticipant = async (projectId, userId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/chat/participants`, {
    method: "POST",
    body: { userId },
    signal,
  });

  return result?.participants || null;
};

export const removeAgencyProjectChatParticipant = async (projectId, memberId, { signal } = {}) => {
  const result = await agencyFetch(
    `/agency/projects/${encodeURIComponent(projectId)}/chat/participants/${encodeURIComponent(memberId)}`,
    {
      method: "DELETE",
      signal,
    },
  );

  return result?.participants || null;
};

export const fetchAgencyAiEstimates = async ({ signal } = {}) => {
  const result = await agencyFetch("/agency/ai/estimates", {
    method: "GET",
    signal,
  });

  return result?.estimates || null;
};

export const fetchAgencyAiBudgets = async ({ signal } = {}) => {
  const result = await agencyFetch("/agency/settings/ai-budgets", {
    method: "GET",
    signal,
  });

  return result?.budgets || null;
};

export const updateAgencyAiBudgets = async (payload, { signal } = {}) => {
  const result = await agencyFetch("/agency/settings/ai-budgets", {
    method: "PUT",
    body: payload,
    signal,
  });

  return result?.budgets || null;
};

export const fetchAgencyProjectWeb = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/web`, {
    method: "GET",
    signal,
  });

  return result?.web || null;
};

export const saveAgencyProjectWeb = async (projectId, payload, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/web`, {
    method: "PUT",
    body: payload,
    signal,
  });

  return result?.web || null;
};

export const generateAgencyWebProjectWithAi = async (projectId, webProjectId, { signal } = {}) => {
  const result = await agencyFetch(
    `/agency/projects/${encodeURIComponent(projectId)}/web-projects/${encodeURIComponent(webProjectId)}/generate-ai`,
    {
      method: "POST",
      signal,
    },
  );

  return result?.web || null;
};

export const generateAgencyWebBlockWithAi = async (projectId, webProjectId, blockKey, { signal } = {}) => {
  const result = await agencyFetch(
    `/agency/projects/${encodeURIComponent(projectId)}/web-projects/${encodeURIComponent(webProjectId)}/generate-block-ai`,
    {
      method: "POST",
      body: { blockKey },
      signal,
    },
  );

  return result?.web || null;
};

export const fetchAgencyProjectAds = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/ads`, {
    method: "GET",
    signal,
  });

  return result?.ads || null;
};

export const saveAgencyProjectAds = async (projectId, payload, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/ads`, {
    method: "PUT",
    body: payload,
    signal,
  });

  return result?.ads || null;
};

export const generateAgencyAdsAssetWithAi = async (projectId, assetKey, { signal } = {}) => {
  const result = await agencyFetch(
    `/agency/projects/${encodeURIComponent(projectId)}/ads/generate-asset-ai`,
    {
      method: "POST",
      body: { assetKey },
      signal,
    },
  );

  return result?.ads || null;
};

export const fetchAgencyProjectReport = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/reports`, {
    method: "GET",
    signal,
  });

  return result?.report || null;
};

export const fetchAgencyProjectReportInput = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/reports/input`, {
    method: "GET",
    signal,
  });

  return result?.input || null;
};

export const fetchAgencyProjectClientReportInput = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/reports/client/input`, {
    method: "GET",
    signal,
  });

  return result?.input || null;
};

export const fetchAgencyProjectClientReport = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/reports/client`, {
    method: "GET",
    signal,
  });

  return result?.clientReport || null;
};

export const saveAgencyProjectClientReport = async (projectId, payload, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/reports/client`, {
    method: "PUT",
    body: payload,
    signal,
  });

  return result?.clientReport || null;
};

export const fetchAgencyProjectDiagnosisInput = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/diagnosis/input`, {
    method: "GET",
    signal,
  });

  return result?.input || null;
};

export const fetchAgencyProjectDiagnosis = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/diagnosis`, {
    method: "GET",
    signal,
  });

  return result?.diagnosis || null;
};

export const saveAgencyProjectDiagnosis = async (projectId, payload, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/diagnosis`, {
    method: "PUT",
    body: payload,
    signal,
  });

  return result?.diagnosis || null;
};

export const saveAgencyProjectReport = async (projectId, payload, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/reports`, {
    method: "PUT",
    body: payload,
    signal,
  });

  return result?.report || null;
};

export const fetchAgencyWorkspaceReports = async ({ signal } = {}) => {
  const result = await agencyFetch("/agency/reports", {
    method: "GET",
    signal,
  });

  return result?.reports || null;
};

export const saveAgencyProjectDiscovery = async (projectId, payload, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/discovery`, {
    method: "PUT",
    body: payload,
    signal,
  });

  return result?.discovery || null;
};

export const fetchAgencyProjectAlerts = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/alerts`, {
    method: "GET",
    signal,
  });

  return result?.alerts || null;
};

export const syncAgencyProjectAlerts = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/alerts/sync`, {
    method: "POST",
    signal,
  });

  return result?.alerts || null;
};

export const fetchAgencyWorkspaceAlerts = async ({ signal } = {}) => {
  const result = await agencyFetch("/agency/alerts", {
    method: "GET",
    signal,
  });

  return result?.alerts || null;
};

export const fetchAgencyProjectOpportunities = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/opportunities`, {
    method: "GET",
    signal,
  });

  return result?.opportunities || null;
};

export const fetchAgencyProjectOpportunityInput = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/opportunities/input`, {
    method: "GET",
    signal,
  });

  return result?.input || null;
};

export const syncAgencyProjectOpportunities = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/opportunities/sync`, {
    method: "POST",
    signal,
  });

  return result?.opportunities || null;
};

export const fetchAgencyWorkspaceOpportunities = async ({ signal } = {}) => {
  const result = await agencyFetch("/agency/opportunities", {
    method: "GET",
    signal,
  });

  return result?.opportunities || null;
};

export const fetchAgencyProjectTasks = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/tasks`, {
    method: "GET",
    signal,
  });

  return result?.tasks || null;
};

export const syncAgencyProjectTasks = async (projectId, { signal } = {}) => {
  const result = await agencyFetch(`/agency/projects/${encodeURIComponent(projectId)}/tasks/sync`, {
    method: "POST",
    signal,
  });

  return result?.tasks || null;
};
