import { useState } from 'react';
import { toast } from 'react-toastify';
import {
  useCreateChecklistTemplateItem,
  useDeleteChecklistTemplateItem,
  useReorderChecklistTemplateItems,
  useUpdateChecklistTemplateItem,
} from '../../../../modules/checklists/hooks/useChecklistsQueries';
import { computeReorderedItemIds, getErrorMessage } from '../templatesPureFunctions';

// Le quattro azioni sugli step del memo aperto: aggiungi, salva la modifica,
// elimina, sposta di una posizione.
//
// `editingItem` e' la riga in modifica: un oggetto intero, non un id, perche' i
// campi si modificano in linea nella lista prima di essere salvati.
//
// Attenzione all'asimmetria dei ricaricamenti, che e' voluta: aggiungere,
// salvare ed eliminare ricaricano ANCHE la lista dei memo, perche' cambia il
// conteggio degli step mostrato nella colonna di sinistra; spostare invece
// ricarica solo il memo aperto, perche' cambiare l'ordine non cambia quel
// conteggio. Uniformarle aggiungerebbe una chiamata al server che oggi non c'e'.
export const useChecklistTemplateItemActions = ({ templatesQuery, selectedTemplateQuery }) => {
  const createItemMutation = useCreateChecklistTemplateItem();
  const updateItemMutation = useUpdateChecklistTemplateItem();
  const deleteItemMutation = useDeleteChecklistTemplateItem();
  const reorderItemsMutation = useReorderChecklistTemplateItems();

  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemRequired, setNewItemRequired] = useState(true);
  const [newItemRequiresEvidence, setNewItemRequiresEvidence] = useState(false);
  const [newItemCritical, setNewItemCritical] = useState(false);
  const [newItemDefaultAssignedToUserId, setNewItemDefaultAssignedToUserId] = useState('');

  const [editingItem, setEditingItem] = useState(null);

  const handleCreateItem = async (event) => {
    event.preventDefault();
    if (!selectedTemplateQuery.data?.id) {
      return;
    }

    const title = newItemTitle.trim();
    if (!title) {
      toast.error('Titolo step obbligatorio');
      return;
    }

    try {
      await createItemMutation.mutate(selectedTemplateQuery.data.id, {
        title,
        description: newItemDescription.trim() || undefined,
        isRequired: newItemRequired,
        requiresEvidenceSnapshot: newItemRequiresEvidence,
        isCriticalSnapshot: newItemCritical,
        defaultAssignedToUserId: newItemDefaultAssignedToUserId || null,
      });
      setNewItemTitle('');
      setNewItemDescription('');
      setNewItemRequired(true);
      setNewItemRequiresEvidence(false);
      setNewItemCritical(false);
      setNewItemDefaultAssignedToUserId('');
      await selectedTemplateQuery.refetch();
      await templatesQuery.refetch();
      toast.success('Step aggiunto');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSaveItem = async () => {
    if (!selectedTemplateQuery.data?.id || !editingItem?.id) {
      return;
    }

    const normalizedTitle = String(editingItem.title || '').trim();
    if (!normalizedTitle) {
      toast.error('Titolo step obbligatorio');
      return;
    }

    try {
      await updateItemMutation.mutate(selectedTemplateQuery.data.id, editingItem.id, {
        title: normalizedTitle,
        description: editingItem.description?.trim() || null,
        isRequired: Boolean(editingItem.isRequired),
        requiresEvidenceSnapshot: Boolean(editingItem.requiresEvidenceSnapshot),
        isCriticalSnapshot: Boolean(editingItem.isCriticalSnapshot),
        defaultAssignedToUserId: editingItem.defaultAssignedToUserId || null,
      });
      setEditingItem(null);
      await selectedTemplateQuery.refetch();
      await templatesQuery.refetch();
      toast.success('Step aggiornato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!selectedTemplateQuery.data?.id) {
      return;
    }

    try {
      await deleteItemMutation.mutate(selectedTemplateQuery.data.id, itemId);
      await selectedTemplateQuery.refetch();
      await templatesQuery.refetch();
      toast.success('Step eliminato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReorderItem = async (itemId, direction) => {
    // Il blocco su `loading` e' un antidoppio-click che hanno solo gli
    // spostamenti: due riordini accavallati manderebbero al server due elenchi
    // diversi calcolati sullo stesso punto di partenza.
    if (!selectedTemplateQuery.data?.id || reorderItemsMutation.loading) {
      return;
    }

    const orderedIds = computeReorderedItemIds(selectedTemplateQuery.data.items, itemId, direction);
    if (!orderedIds) {
      return;
    }

    try {
      await reorderItemsMutation.mutate(selectedTemplateQuery.data.id, orderedIds);
      await selectedTemplateQuery.refetch();
      toast.success('Ordine step aggiornato');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return {
    createItemMutation,
    updateItemMutation,
    deleteItemMutation,
    reorderItemsMutation,
    newItemTitle,
    setNewItemTitle,
    newItemDescription,
    setNewItemDescription,
    newItemRequired,
    setNewItemRequired,
    newItemRequiresEvidence,
    setNewItemRequiresEvidence,
    newItemCritical,
    setNewItemCritical,
    newItemDefaultAssignedToUserId,
    setNewItemDefaultAssignedToUserId,
    editingItem,
    setEditingItem,
    handleCreateItem,
    handleSaveItem,
    handleDeleteItem,
    handleReorderItem,
  };
};

export default useChecklistTemplateItemActions;
