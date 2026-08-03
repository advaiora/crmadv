// Funzioni pure della pipeline progetti: ordinamenti, interpretazione degli
// errori API, normalizzazione del payload delle regole checklist. Estratte da
// src/views/Projects/ProjectPipelineSettings.jsx (fase 2 riordino frontend).
//
// Nate per la sola pagina "Impostazioni Pipeline", oggi sono la versione
// unica anche per la board e il dettaglio progetto, che ne tenevano copie
// identiche: se cambi qualcosa qui, cambia per tutte e tre.
//
// Attenzione a getErrorMessage: in giro per il progetto ci sono altre
// funzioni con lo stesso nome che pero' NON si comportano allo stesso modo —
// per un errore assente alcune tornano "Errore inatteso" invece di stringa
// vuota. Non accorparle senza guardare quel ramo.
// Oggi checklists.api RIESPORTA la stessa isApiError di projects.api: il doppio
// controllo qui sotto e' quindi ridondante, e resta solo per il giorno in cui
// le due API dovessero davvero divergere. Non e' una distinzione reale.
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

// Dalla risposta API alla bozza tenuta in pagina: solo i due campi che
// l'interfaccia modifica. `gateEnabled` manca nelle risposte piu' vecchie:
// assente vale acceso, come faceva la pagina prima dell'estrazione.
export const toStageRulesDraft = (payload) =>
  normalizeStageRulesPayload(payload).map((rule) => ({
    checklistTemplateId: rule.checklistTemplateId,
    gateEnabled: rule.gateEnabled !== false,
  }));

// Spunta o toglie un template dalle regole di uno stage. Se non c'e' niente
// da cambiare torna l'array di partenza (stessa identita'): serve a non far
// ripartire il render per una spunta che non ha spostato nulla.
export const toggleStageRuleTemplate = (rules, templateId, checked) => {
  const hasRule = rules.some((rule) => rule.checklistTemplateId === templateId);

  if (checked && !hasRule) {
    return [...rules, { checklistTemplateId: templateId, gateEnabled: true }];
  }

  if (!checked && hasRule) {
    return rules.filter((rule) => rule.checklistTemplateId !== templateId);
  }

  return rules;
};

export const setStageRuleGate = (rules, templateId, gateEnabled) =>
  rules.map((rule) => (rule.checklistTemplateId === templateId ? { ...rule, gateEnabled } : rule));
