import { useEffect, useState } from 'react';
import { useCreateStage, useDeleteStage, useReorderStages, useUpdateStage } from './usePipelineSettingsQueries';
import { getErrorMessage, isInUseError, isLastStageError, sortStages } from '../ui/pipeline.utils';

const emptyNewStage = (defaultColor) => ({
    name: '',
    color: defaultColor,
    isClosed: false,
    isGated: false,
    gateChecklistTemplateId: '',
    autoCreateInstance: true,
});

// Azioni sugli stage della categoria selezionata (crea, modifica, elimina,
// riordina), estratte da src/views/Projects/ProjectPipelineSettings.jsx
// (fase 2 riordino frontend). L'hook possiede anche l'elenco locale degli
// stage (`stages`): e' la copia ordinata dell'ultima risposta, e il riordino
// la muove SUBITO (ottimistico) — se il salvataggio fallisce si torna
// all'ordine di prima.
//
// Ogni azione torna {attempted, error}, stessa convenzione di
// useStageChecklistRules: il toast lo fa il chiamante. `attempted: false` =
// non partito (con errore = validazione da mostrare, senza = silenzio).
export const usePipelineStageActions = ({ categoryId, stagesQuery, activeChecklistTemplates, defaultStageColor }) => {
    const createMutation = useCreateStage();
    const updateMutation = useUpdateStage();
    const deleteMutation = useDeleteStage();
    const reorderMutation = useReorderStages();

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newStage, setNewStage] = useState(() => emptyNewStage(defaultStageColor));
    const [editingStage, setEditingStage] = useState(null);
    const [deletingStage, setDeletingStage] = useState(null);
    const [stages, setStages] = useState([]);

    useEffect(() => {
        setStages(sortStages(stagesQuery.data || []));
    }, [stagesQuery.data]);

    const closeCreateForm = () => {
        setNewStage(emptyNewStage(defaultStageColor));
        setShowCreateForm(false);
    };

    const createStage = async () => {
        if (!categoryId) {
            return { attempted: false, error: 'Seleziona una categoria' };
        }

        const normalizedName = newStage.name.trim();
        if (!normalizedName) {
            return { attempted: false, error: 'Nome stage obbligatorio' };
        }
        if (newStage.isGated && !newStage.gateChecklistTemplateId) {
            return { attempted: false, error: 'Seleziona un template checklist per il gate' };
        }
        if (newStage.isGated && activeChecklistTemplates.length === 0) {
            return { attempted: false, error: 'Nessun template checklist attivo disponibile' };
        }

        try {
            await createMutation.mutate(categoryId, {
                name: normalizedName,
                isClosed: Boolean(newStage.isClosed),
                color: newStage.color || undefined,
                isGated: Boolean(newStage.isGated),
                gateChecklistTemplateId: newStage.isGated ? newStage.gateChecklistTemplateId || null : null,
                autoCreateInstance: Boolean(newStage.autoCreateInstance),
                sortOrder: stages.length,
            });
            closeCreateForm();
            await stagesQuery.refetch();
            return { attempted: true, error: '' };
        } catch (error) {
            return { attempted: true, error: getErrorMessage(error) || 'Errore creazione stage' };
        }
    };

    const saveStage = async () => {
        if (!editingStage?.id) {
            return { attempted: false, error: '' };
        }

        const normalizedName = String(editingStage.name || '').trim();
        if (!normalizedName) {
            return { attempted: false, error: 'Nome stage obbligatorio' };
        }
        if (editingStage.isGated && !editingStage.gateChecklistTemplateId) {
            return { attempted: false, error: 'Seleziona un template checklist per il gate' };
        }

        try {
            await updateMutation.mutate(editingStage.id, {
                name: normalizedName,
                isClosed: Boolean(editingStage.isClosed),
                color: editingStage.color || null,
                isGated: Boolean(editingStage.isGated),
                gateChecklistTemplateId: editingStage.isGated ? editingStage.gateChecklistTemplateId || null : null,
                autoCreateInstance: Boolean(editingStage.autoCreateInstance),
            });
            setEditingStage(null);
            await stagesQuery.refetch();
            return { attempted: true, error: '' };
        } catch (error) {
            return { attempted: true, error: getErrorMessage(error) || 'Errore salvataggio stage' };
        }
    };

    // Sull'ultimo stage il modal si chiude (non c'e' niente da riprovare);
    // sugli errori del backend resta aperto, come per le categorie.
    const deleteStage = async () => {
        if (!deletingStage?.id) {
            return { attempted: false, error: '' };
        }

        if (stages.length <= 1) {
            setDeletingStage(null);
            return { attempted: false, error: 'Devi avere almeno uno stage nella categoria' };
        }

        try {
            await deleteMutation.mutate(deletingStage.id);
            setDeletingStage(null);
            await stagesQuery.refetch();
            return { attempted: true, error: '' };
        } catch (error) {
            if (isInUseError(error)) {
                return { attempted: true, error: 'Stage in uso: sposta prima i progetti' };
            }
            if (isLastStageError(error)) {
                return { attempted: true, error: 'Devi avere almeno uno stage nella categoria' };
            }

            return { attempted: true, error: getErrorMessage(error) || 'Errore eliminazione stage' };
        }
    };

    const moveStage = async (index, direction) => {
        if (!categoryId || reorderMutation.loading) {
            return { attempted: false, error: '' };
        }

        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= stages.length) {
            return { attempted: false, error: '' };
        }

        const previousStages = [...stages];
        const nextStages = [...stages];
        const temp = nextStages[index];
        nextStages[index] = nextStages[targetIndex];
        nextStages[targetIndex] = temp;

        setStages(nextStages);

        try {
            await reorderMutation.mutate(
                categoryId,
                nextStages.map((stage) => stage.id),
            );
            stagesQuery.refetch();
            return { attempted: true, error: '' };
        } catch (_error) {
            setStages(previousStages);
            return { attempted: true, error: 'Errore salvataggio ordine' };
        }
    };

    return {
        stages,
        showCreateForm,
        setShowCreateForm,
        newStage,
        setNewStage,
        editingStage,
        setEditingStage,
        deletingStage,
        setDeletingStage,
        creating: createMutation.loading,
        saving: updateMutation.loading,
        deleting: deleteMutation.loading,
        reordering: reorderMutation.loading,
        closeCreateForm,
        createStage,
        saveStage,
        deleteStage,
        moveStage,
    };
};
