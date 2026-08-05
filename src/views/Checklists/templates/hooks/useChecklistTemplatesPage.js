import { useChecklistTemplatesData } from './useChecklistTemplatesData';
import { useChecklistTemplateRecordActions } from './useChecklistTemplateRecordActions';
import { useChecklistTemplateItemActions } from './useChecklistTemplateItemActions';

// Hook radice della pagina Memo Operativi: mette insieme i dati con i loro
// derivati, le azioni sul memo e quelle sugli step.
//
// A differenza delle pagine Agency qui NON si nasconde quasi niente: i setter
// dei campi sono legati uno a uno ai rispettivi input, e `setSelectedTemplateId`
// e `setShowArchivedTemplates` sono comandi diretti dell'utente (cliccare una
// riga, accendere il filtro). Nasconderli dietro funzioni dedicate sarebbe una
// riprogettazione, non un'estrazione.
//
// Il nome non e' `useChecklistTemplates` di proposito: quello esiste gia' in
// modules/checklists/hooks/useChecklistsQueries ed e' la richiesta della lista.
export const useChecklistTemplatesPage = (access) => {
  const data = useChecklistTemplatesData(access);

  const recordActions = useChecklistTemplateRecordActions({
    templates: data.templates,
    templatesQuery: data.templatesQuery,
    selectedTemplateQuery: data.selectedTemplateQuery,
    setSelectedTemplateId: data.setSelectedTemplateId,
    setShowArchivedTemplates: data.setShowArchivedTemplates,
  });

  const itemActions = useChecklistTemplateItemActions({
    templatesQuery: data.templatesQuery,
    selectedTemplateQuery: data.selectedTemplateQuery,
  });

  return {
    ...data,
    ...recordActions,
    ...itemActions,
  };
};

export default useChecklistTemplatesPage;
