import React, { useState } from 'react';
import { toast } from 'react-toastify';
import {
  useArchiveChecklistTemplate,
  useCreateChecklistTemplate,
  useDeleteChecklistTemplatePermanently,
  useUpdateChecklistTemplate,
} from '../../../../modules/checklists/hooks/useChecklistsQueries';
import { findDuplicateTemplateByName, getErrorMessage } from '../templatesPureFunctions';

// Le quattro azioni sul memo: crea, aggiorna, archivia, elimina definitivamente.
//
// Riceve dall'hook dei dati quello che deve leggere e scrivere invece di
// tenerne una copia: l'elenco dei memo (per il controllo dei duplicati), il
// memo aperto, e i due comandi `setSelectedTemplateId`/`setShowArchivedTemplates`,
// che qui servono per portare l'utente sul memo giusto.
//
// Chi ricarica cosa e' diverso per ogni azione e va lasciato com'e':
// - creare ricarica la lista, poi seleziona il nuovo memo (che si carica da se');
// - aggiornare ricarica lista e memo aperto, perche' il nome compare in tutte e due;
// - archiviare ricarica la lista, poi accende il filtro e riseleziona, e solo
//   dopo ricarica il memo aperto;
// - eliminare ricarica la lista e azzera la selezione, quindi non c'e' piu' un
//   memo aperto da ricaricare.
export const useChecklistTemplateRecordActions = ({
  templates,
  templatesQuery,
  selectedTemplateQuery,
  setSelectedTemplateId,
  setShowArchivedTemplates,
}) => {
  const createTemplateMutation = useCreateChecklistTemplate();
  const updateTemplateMutation = useUpdateChecklistTemplate();
  const archiveTemplateMutation = useArchiveChecklistTemplate();
  const deleteTemplatePermanentlyMutation = useDeleteChecklistTemplatePermanently();

  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [editingTemplateName, setEditingTemplateName] = useState('');
  const [editingTemplateDescription, setEditingTemplateDescription] = useState('');

  // La bozza si riempie SOLO quando cambia il memo aperto, non a ogni arrivo di
  // dati dal server. Il lint segnala la dipendenza incompleta (lo faceva anche
  // sull'originale, stessa riga): e' voluta. Mettendo l'intero `data` fra le
  // dipendenze, ogni ricaricamento — e ce n'e' uno dopo ogni azione sugli step
  // — riscriverebbe i due campi cancellando quello che l'utente sta digitando.
  React.useEffect(() => {
    if (!selectedTemplateQuery.data) {
      return;
    }

    setEditingTemplateName(selectedTemplateQuery.data.name || '');
    setEditingTemplateDescription(selectedTemplateQuery.data.description || '');
  }, [selectedTemplateQuery.data?.id]);

  const handleCreateTemplate = async (event) => {
    event.preventDefault();
    const name = newTemplateName.trim();
    if (!name) {
      toast.error('Nome memo obbligatorio');
      return;
    }

    // Se il nome c'e' gia' non si crea niente: si porta l'utente sul memo che
    // esiste, scoprendo gli archiviati se era li' dentro.
    const duplicateTemplate = findDuplicateTemplateByName(templates, name);
    if (duplicateTemplate) {
      setSelectedTemplateId(duplicateTemplate.id);
      if (duplicateTemplate.isArchived) {
        setShowArchivedTemplates(true);
        toast.error('Esiste gia un memo archiviato con questo nome');
      } else {
        toast.info('Esiste gia un memo con questo nome');
      }
      return;
    }

    try {
      const created = await createTemplateMutation.mutate({
        name,
        description: newTemplateDescription.trim() || undefined,
      });
      setNewTemplateName('');
      setNewTemplateDescription('');
      await templatesQuery.refetch();
      setSelectedTemplateId(created.id);
      toast.success('Memo creato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdateTemplate = async () => {
    if (!selectedTemplateQuery.data?.id) {
      return;
    }

    const nextName = editingTemplateName.trim();
    if (!nextName) {
      toast.error('Nome memo obbligatorio');
      return;
    }

    const duplicateTemplate = findDuplicateTemplateByName(templates, nextName, {
      excludeId: selectedTemplateQuery.data.id,
    });
    if (duplicateTemplate) {
      setSelectedTemplateId(duplicateTemplate.id);
      if (duplicateTemplate.isArchived) {
        setShowArchivedTemplates(true);
        toast.error('Nome gia usato da un memo archiviato');
      } else {
        toast.error('Nome gia usato da un altro memo');
      }
      return;
    }

    try {
      await updateTemplateMutation.mutate(selectedTemplateQuery.data.id, {
        name: nextName,
        description: editingTemplateDescription.trim() || null,
      });
      await templatesQuery.refetch();
      await selectedTemplateQuery.refetch();
      toast.success('Memo aggiornato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleArchiveTemplate = async () => {
    if (!selectedTemplateQuery.data?.id) {
      return;
    }

    const archivedTemplateId = selectedTemplateQuery.data.id;

    try {
      await archiveTemplateMutation.mutate(archivedTemplateId);
      await templatesQuery.refetch();
      setShowArchivedTemplates(true);
      setSelectedTemplateId(archivedTemplateId);
      await selectedTemplateQuery.refetch();
      toast.success('Memo archiviato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  // Si puo' eliminare per sempre solo un memo gia' archiviato.
  const handleDeleteTemplatePermanently = async () => {
    if (!selectedTemplateQuery.data?.id || !selectedTemplateQuery.data.isArchived) {
      return;
    }

    const confirmed = window.confirm(
      'Questa azione elimina definitivamente il memo archiviato. Vuoi continuare?',
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteTemplatePermanentlyMutation.mutate(selectedTemplateQuery.data.id);
      await templatesQuery.refetch();
      setSelectedTemplateId('');
      toast.success('Memo eliminato definitivamente');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return {
    createTemplateMutation,
    updateTemplateMutation,
    archiveTemplateMutation,
    deleteTemplatePermanentlyMutation,
    newTemplateName,
    setNewTemplateName,
    newTemplateDescription,
    setNewTemplateDescription,
    editingTemplateName,
    setEditingTemplateName,
    editingTemplateDescription,
    setEditingTemplateDescription,
    handleCreateTemplate,
    handleUpdateTemplate,
    handleArchiveTemplate,
    handleDeleteTemplatePermanently,
  };
};

export default useChecklistTemplateRecordActions;
