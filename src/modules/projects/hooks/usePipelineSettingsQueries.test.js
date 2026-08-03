import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { listCategories, listStages } from '../api/projects.api';
import { usePipelineCategories, usePipelineStages } from './usePipelineSettingsQueries';

// Modulo API finto: qui si misura la macchina a stati delle query, in
// particolare il CONTRATTO di refetch — la promessa risolve quando i dati
// sono arrivati, non quando la richiesta e' solo partita. E' il contratto
// su cui si appoggia la selezione della categoria appena creata (il fix
// della corsa refetch/validazione del 3/8/2026).
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
    isApiError: () => false,
}));

beforeEach(() => {
    listCategories.mockReset();
    listStages.mockReset();
});

describe('usePipelineCategories — refetch', () => {
    it('la promessa risolve quando i dati NUOVI sono arrivati, non prima', async () => {
        const consegne = [];
        listCategories.mockImplementation(() => new Promise((resolve) => { consegne.push(resolve); }));

        const { result } = renderHook(() => usePipelineCategories());

        await act(async () => {
            consegne[0]([{ id: 'c1' }]);
        });
        expect(result.current.data).toEqual([{ id: 'c1' }]);

        let risolta = false;
        let promessa;
        act(() => {
            promessa = result.current.refetch();
            promessa.then(() => { risolta = true; });
        });

        // La richiesta e' partita ma i dati non sono ancora arrivati: la
        // promessa deve restare in sospeso (prima del fix risolveva subito).
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(risolta).toBe(false);
        expect(result.current.loading).toBe(true);

        await act(async () => {
            consegne[1]([{ id: 'c1' }, { id: 'c9' }]);
            await promessa;
        });
        expect(risolta).toBe(true);
        expect(result.current.data).toEqual([{ id: 'c1' }, { id: 'c9' }]);
    });

    // Attenzione al pattern: refetch va INNESCATO in un act sincrono e ATTESO
    // in un secondo act. Un solo `await act(async () => await refetch())` va
    // in stallo: l'effetto che risolve la promessa non parte finche' il
    // callback non finisce, e il callback aspetta la promessa.
    it('anche su errore la promessa risolve (niente attese appese), con lo stato di errore', async () => {
        listCategories.mockResolvedValueOnce([{ id: 'c1' }]).mockRejectedValueOnce(new Error('rete giu'));

        const { result } = renderHook(() => usePipelineCategories());
        await waitFor(() => expect(result.current.loading).toBe(false));

        let promessa;
        act(() => {
            promessa = result.current.refetch();
        });
        await act(async () => {
            await promessa;
        });

        expect(result.current.error?.message).toBe('rete giu');
        expect(result.current.data).toEqual([]);
    });
});

describe('usePipelineStages — refetch a query spenta', () => {
    it('senza categoria la promessa risolve subito e lo stato resta a riposo', async () => {
        const { result } = renderHook(() => usePipelineStages(''));

        let promessa;
        act(() => {
            promessa = result.current.refetch();
        });
        await act(async () => {
            await promessa;
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.data).toEqual([]);
        expect(listStages).not.toHaveBeenCalled();
    });
});
