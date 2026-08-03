import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createCategory, deleteCategory, updateCategory } from '../api/projects.api';
import { usePipelineCategoryActions } from './usePipelineCategoryActions';

// Le mutazioni parlano col backend: qui il modulo API e' finto, cosi' il test
// misura esiti e stato (nome, modali, selezione) e non la rete. isApiError
// riconosce i finti errori dal marcatore `isApi`: serve a esercitare anche il
// ramo "categoria in uso", che passa da isInUseError.
vi.mock('../api/projects.api', () => ({
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    listCategories: vi.fn(),
    listStages: vi.fn(),
    createStage: vi.fn(),
    updateStage: vi.fn(),
    deleteStage: vi.fn(),
    reorderStages: vi.fn(),
    isApiError: (error) => Boolean(error?.isApi),
}));

const renderActions = (overrides = {}) => {
    const props = {
        categoriesQuery: { refetch: vi.fn() },
        categoryId: 'c1',
        setCategoryId: vi.fn(),
        ...overrides,
    };
    const view = renderHook(() => usePipelineCategoryActions(props));
    return { ...view, props };
};

beforeEach(() => {
    createCategory.mockReset();
    updateCategory.mockReset();
    deleteCategory.mockReset();
});

describe('usePipelineCategoryActions', () => {
    it('la creazione senza nome non parte, col motivo da mostrare', async () => {
        const { result } = renderActions();

        let esito;
        await act(async () => {
            esito = await result.current.createCategory();
        });

        expect(esito).toEqual({ attempted: false, error: 'Nome categoria obbligatorio' });
        expect(createCategory).not.toHaveBeenCalled();
    });

    it('la creazione riuscita pulisce il campo, ricarica e seleziona la nuova categoria', async () => {
        createCategory.mockResolvedValue({ id: 'c9' });
        const { result, props } = renderActions();

        act(() => result.current.setNewCategoryName('  Vendite  '));

        let esito;
        await act(async () => {
            esito = await result.current.createCategory();
        });

        expect(esito).toEqual({ attempted: true, error: '' });
        expect(createCategory).toHaveBeenCalledWith({ name: 'Vendite' });
        expect(props.categoriesQuery.refetch).toHaveBeenCalled();
        expect(props.setCategoryId).toHaveBeenCalledWith('c9');
        expect(result.current.newCategoryName).toBe('');
    });

    it('la creazione fallita torna il messaggio e non butta il nome scritto', async () => {
        createCategory.mockRejectedValue(new Error('rete giu'));
        const { result } = renderActions();

        act(() => result.current.setNewCategoryName('Vendite'));

        let esito;
        await act(async () => {
            esito = await result.current.createCategory();
        });

        expect(esito).toEqual({ attempted: true, error: 'rete giu' });
        expect(result.current.newCategoryName).toBe('Vendite');
    });

    it('la rinomina senza categoria aperta resta zitta', async () => {
        const { result } = renderActions();

        let esito;
        await act(async () => {
            esito = await result.current.saveRename();
        });

        expect(esito).toEqual({ attempted: false, error: '' });
        expect(updateCategory).not.toHaveBeenCalled();
    });

    it('la rinomina con nome vuoto non parte, col motivo da mostrare', async () => {
        const { result } = renderActions();

        act(() => result.current.setEditingCategory({ id: 'c1', name: '   ' }));

        let esito;
        await act(async () => {
            esito = await result.current.saveRename();
        });

        expect(esito).toEqual({ attempted: false, error: 'Nome categoria obbligatorio' });
        expect(updateCategory).not.toHaveBeenCalled();
        expect(result.current.editingCategory).not.toBeNull();
    });

    it('la rinomina salva il nome normalizzato e chiude il modal', async () => {
        updateCategory.mockResolvedValue({});
        const { result, props } = renderActions();

        act(() => result.current.setEditingCategory({ id: 'c1', name: '  Nuovo nome  ' }));

        let esito;
        await act(async () => {
            esito = await result.current.saveRename();
        });

        expect(esito).toEqual({ attempted: true, error: '' });
        expect(updateCategory).toHaveBeenCalledWith('c1', { name: 'Nuovo nome' });
        expect(result.current.editingCategory).toBeNull();
        expect(props.categoriesQuery.refetch).toHaveBeenCalled();
    });

    it("l'eliminazione di una categoria in uso spiega il blocco e lascia il modal aperto", async () => {
        deleteCategory.mockRejectedValue({ isApi: true, code: 'IN_USE', message: 'in uso' });
        const { result } = renderActions();

        act(() => result.current.setDeletingCategory({ id: 'c1', name: 'Consulenza' }));

        let esito;
        await act(async () => {
            esito = await result.current.deleteCategory();
        });

        expect(esito).toEqual({ attempted: true, error: 'Categoria in uso: elimina prima stage e progetti' });
        expect(result.current.deletingCategory).not.toBeNull();
    });

    it("eliminare la categoria selezionata azzera la selezione, un'altra no", async () => {
        deleteCategory.mockResolvedValue({});

        const selezionata = renderActions();
        act(() => selezionata.result.current.setDeletingCategory({ id: 'c1' }));
        await act(async () => {
            await selezionata.result.current.deleteCategory();
        });
        expect(selezionata.props.setCategoryId).toHaveBeenCalledWith('');
        expect(selezionata.result.current.deletingCategory).toBeNull();

        const altra = renderActions();
        act(() => altra.result.current.setDeletingCategory({ id: 'c2' }));
        await act(async () => {
            await altra.result.current.deleteCategory();
        });
        expect(altra.props.setCategoryId).not.toHaveBeenCalled();
        expect(altra.result.current.deletingCategory).toBeNull();
    });
});
