import React, { useMemo, useState } from 'react';
import {
  useChecklistAssignableUsers,
  useChecklistTemplate,
  useChecklistTemplates,
} from '../../../../modules/checklists/hooks/useChecklistsQueries';
import { hasPermission } from '../../../../utils/workspaceAccess';
import { filterVisibleTemplates, sumTemplateItems } from '../templatesPureFunctions';

// Dati, permessi e derivati della pagina Memo Operativi.
//
// `selectedTemplateId` e `showArchivedTemplates` stanno qui perche' e' qui che
// si costruisce la richiesta del memo aperto e l'elenco visibile, ma i loro
// setter restano PUBBLICI: li scrivono sia le azioni (creare un memo lo
// seleziona, archiviarlo accende il filtro degli archiviati) sia l'utente
// direttamente, cliccando una riga della lista o il bottone del filtro. Non
// sono setter grezzi da nascondere come nelle pagine Agency: sono comandi.
//
// I sette valori calcolati in fondo sono DERIVATI: si ricalcolano a ogni
// render, mai tenuti in uno stato proprio, altrimenti dopo un ricaricamento
// resterebbero indietro.
export const useChecklistTemplatesData = (access) => {
  // Solo 'checklists.manage_templates': era in OR con checklists.edit / .create /
  // .delete, che nel catalogo esistono ma NESSUNA rotta del server controlla — le
  // mutazioni sui modelli chiedono tutte manage_templates. Chi avesse ricevuto le
  // tre chiavi da sole vedeva i pulsanti e prendeva un 403 al salvataggio: un
  // permesso apparente. (Audit del 7/8/2026; le tre chiavi restano nel catalogo,
  // sono segnate in roadmap fra le voci senza rotta.)
  const canManageTemplates = hasPermission(access, 'checklists.manage_templates');
  const canCreateTemplate = canManageTemplates;
  const canDeleteTemplate = canManageTemplates;

  const templatesQuery = useChecklistTemplates();
  const assignableUsersQuery = useChecklistAssignableUsers({ enabled: canManageTemplates });
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const selectedTemplateQuery = useChecklistTemplate(selectedTemplateId);

  const [templateSearch, setTemplateSearch] = useState('');
  const [showArchivedTemplates, setShowArchivedTemplates] = useState(false);

  const templates = useMemo(() => templatesQuery.data || [], [templatesQuery.data]);
  const assignableUsers = useMemo(
    () => (Array.isArray(assignableUsersQuery.data) ? assignableUsersQuery.data : []),
    [assignableUsersQuery.data],
  );
  const visibleTemplates = useMemo(
    () => filterVisibleTemplates(templates, { search: templateSearch, showArchived: showArchivedTemplates }),
    [showArchivedTemplates, templateSearch, templates],
  );
  const totalVisibleItems = useMemo(() => sumTemplateItems(visibleTemplates), [visibleTemplates]);

  React.useEffect(() => {
    // Keep selection stable and avoid ping-pong when only archived templates exist.
    const selectableTemplates = showArchivedTemplates ? templates : visibleTemplates;

    if (selectableTemplates.length === 0) {
      if (selectedTemplateId) {
        setSelectedTemplateId('');
      }
      return;
    }

    const isSelectedVisible = selectableTemplates.some((template) => template.id === selectedTemplateId);
    if (!isSelectedVisible) {
      setSelectedTemplateId(selectableTemplates[0].id);
    }
  }, [selectedTemplateId, showArchivedTemplates, templates, visibleTemplates]);

  return {
    canManageTemplates,
    canCreateTemplate,
    canDeleteTemplate,
    templatesQuery,
    selectedTemplateQuery,
    selectedTemplateId,
    setSelectedTemplateId,
    templateSearch,
    setTemplateSearch,
    showArchivedTemplates,
    setShowArchivedTemplates,
    templates,
    assignableUsers,
    visibleTemplates,
    totalVisibleItems,
  };
};

export default useChecklistTemplatesData;
