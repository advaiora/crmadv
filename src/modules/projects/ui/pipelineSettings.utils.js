// Funzioni pure della pagina "Impostazioni Pipeline", estratte da
// src/views/Projects/ProjectPipelineSettings.jsx (fase 2 riordino frontend).
// Ordinamenti, interpretazione errori API e normalizzazione payload regole.
import { isApiError as isChecklistApiError } from "../../checklists/api/checklists.api";
import { isApiError as isProjectApiError } from "../api/projects.api";

export const sortCategories = (categories) =>
  [...categories].sort((left, right) => {
    const leftOrder = Number(left?.sortOrder);
    const rightOrder = Number(right?.sortOrder);
    const safeLeftOrder = Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER;
    const safeRightOrder = Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER;

    if (safeLeftOrder !== safeRightOrder) {
      return safeLeftOrder - safeRightOrder;
    }

    return String(left?.name || "").localeCompare(String(right?.name || ""), "it");
  });

export const sortStages = (stages) =>
  [...stages].sort((left, right) => {
    const leftOrder = Number(left?.sortOrder);
    const rightOrder = Number(right?.sortOrder);
    const safeLeftOrder = Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER;
    const safeRightOrder = Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER;

    if (safeLeftOrder !== safeRightOrder) {
      return safeLeftOrder - safeRightOrder;
    }

    return String(left?.name || "").localeCompare(String(right?.name || ""), "it");
  });

export const getErrorMessage = (error) => {
  if (!error) {
    return "";
  }

  if (isProjectApiError(error) || isChecklistApiError(error)) {
    return `${error.message} (${error.code || error.status || "API_ERROR"})`;
  }

  return error?.message || "Errore inatteso";
};

export const isInUseError = (error) => isProjectApiError(error) && (error.code === "IN_USE" || error.status === 409);

export const isLastStageError = (error) => isProjectApiError(error) && (error.code === "LAST_STAGE_REQUIRED" || error.status === 400);

export const normalizeStageRulesPayload = (payload) => {
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
};
