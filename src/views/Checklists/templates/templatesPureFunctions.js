import { isApiError } from '../../../modules/checklists/api/checklists.api';

// Funzioni pure della pagina Memo Operativi (checklist template).
// Estratte da ChecklistTemplates.jsx nel giro di spezzatura del 5/8/2026.

export const getErrorMessage = (error) => {
  if (!error) {
    return 'Errore inatteso';
  }
  if (isApiError(error)) {
    return `${error.message} (${error.code || error.status || 'API_ERROR'})`;
  }
  return error?.message || 'Errore inatteso';
};

export const normalizeTemplateName = (value) => String(value || '').trim().toLowerCase();

// Cerca un memo con lo stesso nome, ignorando maiuscole e spazi ai bordi.
// `excludeId` serve in modifica, per non far risultare duplicato di se stesso
// il memo che si sta rinominando.
//
// Nota: questo controllo e' piu' severo del vincolo del database, che distingue
// maiuscole e minuscole. E' il comportamento gia' in uso; la domanda di prodotto
// che ne deriva e' annotata in roadmap, sotto il debito tecnico.
export const findDuplicateTemplateByName = (templates, name, { excludeId } = {}) => {
  const normalized = normalizeTemplateName(name);
  if (!normalized) {
    return undefined;
  }

  return (templates || []).find(
    (template) => template.id !== excludeId && normalizeTemplateName(template.name) === normalized,
  );
};

// La ricerca guarda nome e descrizione insieme. Gli archiviati restano fuori
// finche' non si accende il filtro apposta.
export const filterVisibleTemplates = (templates, { search = '', showArchived = false } = {}) => {
  const normalizedSearch = String(search || '').trim().toLowerCase();

  return (templates || []).filter((template) => {
    if (!showArchived && template.isArchived) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return `${template.name} ${template.description || ''}`.toLowerCase().includes(normalizedSearch);
  });
};

export const sumTemplateItems = (templates) => (
  (templates || []).reduce((acc, template) => acc + (template.itemsCount || 0), 0)
);

// Sposta uno step di una posizione e restituisce l'elenco COMPLETO degli id nel
// nuovo ordine: e' quello che si manda al server, che riassegna la posizione in
// base all'ordine ricevuto.
//
// Torna `null` quando il movimento non si puo' fare — step sconosciuto, oppure
// gia' primo che sale o gia' ultimo che scende: sono i due punti in cui
// l'originale usciva senza chiamare il server.
export const computeReorderedItemIds = (items, itemId, direction) => {
  const list = items || [];
  const currentIndex = list.findIndex((item) => item.id === itemId);
  if (currentIndex < 0) {
    return null;
  }

  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= list.length) {
    return null;
  }

  const orderedIds = list.map((item) => item.id);
  const temp = orderedIds[currentIndex];
  orderedIds[currentIndex] = orderedIds[targetIndex];
  orderedIds[targetIndex] = temp;

  return orderedIds;
};
