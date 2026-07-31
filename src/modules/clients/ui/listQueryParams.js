// Parsing e validazione dei parametri di querystring della lista clienti
// (pagina, ordinamento, tipo, dimensione pagina). Estratte da ClientsList.jsx
// il 30/7/2026 (fase 2 riordino frontend): pure, senza React ne' DOM.
import { CLIENTS_PAGE_SIZE_OPTIONS, CLIENTS_SORT_OPTIONS } from "./constants";

export const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export const parseSort = (value) => {
  const hasOption = CLIENTS_SORT_OPTIONS.some((option) => option.value === value);
  return hasOption ? value : "-updatedAt";
};

export const parseType = (value) => (value === "person" || value === "company" ? value : "all");

export const parsePageSize = (value) => {
  const parsed = parsePositiveInt(value, CLIENTS_PAGE_SIZE_OPTIONS[0]);
  return CLIENTS_PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : CLIENTS_PAGE_SIZE_OPTIONS[0];
};

export const getSortLabel = (sort) => CLIENTS_SORT_OPTIONS.find((option) => option.value === sort)?.label || "Aggiornati di recente";
