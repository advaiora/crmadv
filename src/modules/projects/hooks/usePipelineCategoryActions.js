import { useState } from 'react';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from './usePipelineSettingsQueries';
import { getErrorMessage, isInUseError } from '../ui/pipeline.utils';

// Azioni sulle categorie della pipeline (crea, rinomina, elimina), estratte da
// src/views/Projects/ProjectPipelineSettings.jsx (fase 2 riordino frontend).
// L'hook possiede lo stato dei tre percorsi (nome della nuova categoria,
// categoria in rinomina, categoria in eliminazione) e le mutazioni; selezione
// e refetch restano della pagina e arrivano da fuori.
//
// Ogni azione torna {attempted, error}, stessa convenzione di
// useStageChecklistRules: il toast lo fa il chiamante, l'hook non conosce
// l'interfaccia. `attempted: false` = non partito (se c'e' un errore e' una
// validazione da mostrare, se e' vuoto si resta zitti).
export const usePipelineCategoryActions = ({ categoriesQuery, categoryId, setCategoryId }) => {
    const createMutation = useCreateCategory();
    const renameMutation = useUpdateCategory();
    const deleteMutation = useDeleteCategory();

    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState(null);
    const [deletingCategory, setDeletingCategory] = useState(null);

    const createCategory = async () => {
        const normalizedName = newCategoryName.trim();
        if (!normalizedName) {
            return { attempted: false, error: 'Nome categoria obbligatorio' };
        }

        try {
            const createdCategory = await createMutation.mutate({ name: normalizedName });
            setNewCategoryName('');
            await categoriesQuery.refetch();
            setCategoryId(createdCategory?.id || '');
            return { attempted: true, error: '' };
        } catch (error) {
            return { attempted: true, error: getErrorMessage(error) || 'Errore creazione categoria' };
        }
    };

    const saveRename = async () => {
        if (!editingCategory?.id) {
            return { attempted: false, error: '' };
        }

        const normalizedName = String(editingCategory.name || '').trim();
        if (!normalizedName) {
            return { attempted: false, error: 'Nome categoria obbligatorio' };
        }

        try {
            await renameMutation.mutate(editingCategory.id, { name: normalizedName });
            setEditingCategory(null);
            await categoriesQuery.refetch();
            return { attempted: true, error: '' };
        } catch (error) {
            return { attempted: true, error: getErrorMessage(error) || 'Errore salvataggio categoria' };
        }
    };

    // Sugli errori (categoria in uso compresa) il modal resta aperto apposta:
    // chiudere confermerebbe a occhio un'eliminazione mai avvenuta.
    const deleteCategory = async () => {
        if (!deletingCategory?.id) {
            return { attempted: false, error: '' };
        }

        try {
            await deleteMutation.mutate(deletingCategory.id);
            const deletedCategoryId = deletingCategory.id;
            setDeletingCategory(null);
            await categoriesQuery.refetch();
            if (deletedCategoryId === categoryId) {
                setCategoryId('');
            }
            return { attempted: true, error: '' };
        } catch (error) {
            if (isInUseError(error)) {
                return { attempted: true, error: 'Categoria in uso: elimina prima stage e progetti' };
            }

            return { attempted: true, error: getErrorMessage(error) || 'Errore eliminazione categoria' };
        }
    };

    return {
        newCategoryName,
        setNewCategoryName,
        editingCategory,
        setEditingCategory,
        deletingCategory,
        setDeletingCategory,
        creating: createMutation.loading,
        renaming: renameMutation.loading,
        deleting: deleteMutation.loading,
        createCategory,
        saveRename,
        deleteCategory,
    };
};
