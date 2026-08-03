import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createStage, deleteStage, reorderStages, updateStage } from '../api/projects.api';
import { usePipelineStageActions } from './usePipelineStageActions';

// Modulo API finto (vedi usePipelineCategoryActions.test): si misura la
// macchina a stati, non la rete. Il marcatore `isApi` sui finti errori
// accende isInUseError/isLastStageError per i rami "in uso" e "ultimo stage".
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

// Dati apposta in disordine: l'hook deve ordinarli per sortOrder.
// Niente hex reali nelle fixture colore (guard lint:colors su src/modules).
const stagesData = [
    { id: 's2', name: 'Beta', sortOrder: 2 },
    { id: 's1', name: 'Alfa', sortOrder: 1 },
];

const renderActions = (overrides = {}) => {
    const props = {
        categoryId: 'c1',
        stagesQuery: { data: stagesData, refetch: vi.fn() },
        activeChecklistTemplates: [{ id: 't1', name: 'Onboarding' }],
        defaultStageColor: 'colore-di-prova',
        ...overrides,
    };
    const view = renderHook((current) => usePipelineStageActions(current), { initialProps: props });
    return { ...view, props };
};

beforeEach(() => {
    createStage.mockReset();
    updateStage.mockReset();
    deleteStage.mockReset();
    reorderStages.mockReset();
});

describe('usePipelineStageActions — elenco locale e creazione', () => {
    it("tiene l'elenco locale ordinato e lo riallinea quando cambia la risposta", () => {
        const { result, rerender, props } = renderActions();
        expect(result.current.stages.map((stage) => stage.id)).toEqual(['s1', 's2']);

        rerender({ ...props, stagesQuery: { ...props.stagesQuery, data: [{ id: 's3', sortOrder: 0 }] } });
        expect(result.current.stages.map((stage) => stage.id)).toEqual(['s3']);
    });

    it('la creazione si ferma prima di partire sui casi non validi', async () => {
        let esito;

        const senzaCategoria = renderActions({ categoryId: '' });
        await act(async () => {
            esito = await senzaCategoria.result.current.createStage();
        });
        expect(esito).toEqual({ attempted: false, error: 'Seleziona una categoria' });

        const { result } = renderActions();
        await act(async () => {
            esito = await result.current.createStage();
        });
        expect(esito).toEqual({ attempted: false, error: 'Nome stage obbligatorio' });

        act(() => result.current.setNewStage((current) => ({ ...current, name: 'Nuovo', isGated: true, gateChecklistTemplateId: '' })));
        await act(async () => {
            esito = await result.current.createStage();
        });
        expect(esito).toEqual({ attempted: false, error: 'Seleziona un template checklist per il gate' });

        const senzaTemplate = renderActions({ activeChecklistTemplates: [] });
        act(() => senzaTemplate.result.current.setNewStage((current) => ({ ...current, name: 'Nuovo', isGated: true, gateChecklistTemplateId: 't9' })));
        await act(async () => {
            esito = await senzaTemplate.result.current.createStage();
        });
        expect(esito).toEqual({ attempted: false, error: 'Nessun template checklist attivo disponibile' });

        expect(createStage).not.toHaveBeenCalled();
    });

    it('la creazione riuscita manda il payload giusto, chiude e svuota il modulo', async () => {
        createStage.mockResolvedValue({});
        const { result, props } = renderActions();

        act(() => result.current.setShowCreateForm(true));
        act(() => result.current.setNewStage((current) => ({ ...current, name: '  Consegna  ', isClosed: true })));

        let esito;
        await act(async () => {
            esito = await result.current.createStage();
        });

        expect(esito).toEqual({ attempted: true, error: '' });
        expect(createStage).toHaveBeenCalledWith('c1', {
            name: 'Consegna',
            isClosed: true,
            color: 'colore-di-prova',
            isGated: false,
            gateChecklistTemplateId: null,
            autoCreateInstance: true,
            sortOrder: 2,
        });
        expect(result.current.showCreateForm).toBe(false);
        expect(result.current.newStage.name).toBe('');
        expect(result.current.newStage.color).toBe('colore-di-prova');
        expect(props.stagesQuery.refetch).toHaveBeenCalled();
    });
});

describe('usePipelineStageActions — modifica, eliminazione e riordino', () => {
    it('il salvataggio si ferma prima di partire sui casi non validi (nome vuoto, gate senza template)', async () => {
        const { result } = renderActions();
        let esito;

        act(() => result.current.setEditingStage({ id: 's1', name: '   ' }));
        await act(async () => {
            esito = await result.current.saveStage();
        });
        expect(esito).toEqual({ attempted: false, error: 'Nome stage obbligatorio' });

        act(() => result.current.setEditingStage({ id: 's1', name: 'Alfa', isGated: true, gateChecklistTemplateId: '' }));
        await act(async () => {
            esito = await result.current.saveStage();
        });
        expect(esito).toEqual({ attempted: false, error: 'Seleziona un template checklist per il gate' });

        expect(updateStage).not.toHaveBeenCalled();
    });

    it('salvare uno stage non gated azzera il template del gate e chiude il modal', async () => {
        updateStage.mockResolvedValue({});
        const { result } = renderActions();

        act(() =>
            result.current.setEditingStage({
                id: 's1',
                name: '  Alfa 2  ',
                isClosed: false,
                color: '',
                isGated: false,
                gateChecklistTemplateId: 't1',
                autoCreateInstance: false,
            }),
        );

        let esito;
        await act(async () => {
            esito = await result.current.saveStage();
        });

        expect(esito).toEqual({ attempted: true, error: '' });
        expect(updateStage).toHaveBeenCalledWith('s1', {
            name: 'Alfa 2',
            isClosed: false,
            color: null,
            isGated: false,
            gateChecklistTemplateId: null,
            autoCreateInstance: false,
        });
        expect(result.current.editingStage).toBeNull();
    });

    it("l'ultimo stage non si elimina: modal chiuso, motivo detto, backend mai chiamato", async () => {
        const { result } = renderActions({ stagesQuery: { data: [stagesData[0]], refetch: vi.fn() } });

        act(() => result.current.setDeletingStage({ id: 's2' }));

        let esito;
        await act(async () => {
            esito = await result.current.deleteStage();
        });

        expect(esito).toEqual({ attempted: false, error: 'Devi avere almeno uno stage nella categoria' });
        expect(result.current.deletingStage).toBeNull();
        expect(deleteStage).not.toHaveBeenCalled();
    });

    it('uno stage in uso non si elimina e il modal resta aperto', async () => {
        deleteStage.mockRejectedValue({ isApi: true, status: 409, message: 'in uso' });
        const { result } = renderActions();

        act(() => result.current.setDeletingStage({ id: 's1' }));

        let esito;
        await act(async () => {
            esito = await result.current.deleteStage();
        });

        expect(esito).toEqual({ attempted: true, error: 'Stage in uso: sposta prima i progetti' });
        expect(result.current.deletingStage).not.toBeNull();
    });

    it("se e' il backend a rispondere LAST_STAGE_REQUIRED, il messaggio resta quello amichevole", async () => {
        deleteStage.mockRejectedValue({ isApi: true, code: 'LAST_STAGE_REQUIRED', message: 'last stage required' });
        const { result } = renderActions();

        act(() => result.current.setDeletingStage({ id: 's1' }));

        let esito;
        await act(async () => {
            esito = await result.current.deleteStage();
        });

        expect(esito).toEqual({ attempted: true, error: 'Devi avere almeno uno stage nella categoria' });
        expect(result.current.deletingStage).not.toBeNull();
    });

    it('il riordino riuscito tiene il nuovo ordine e lo manda al backend', async () => {
        reorderStages.mockResolvedValue({});
        const { result, props } = renderActions();

        let esito;
        await act(async () => {
            esito = await result.current.moveStage(0, 1);
        });

        expect(esito).toEqual({ attempted: true, error: '' });
        expect(reorderStages).toHaveBeenCalledWith('c1', ['s2', 's1']);
        expect(result.current.stages.map((stage) => stage.id)).toEqual(['s2', 's1']);
        expect(props.stagesQuery.refetch).toHaveBeenCalled();
    });

    it('il riordino fallito torna come prima (mossa ottimistica annullata)', async () => {
        reorderStages.mockRejectedValue(new Error('rete giu'));
        const { result } = renderActions();

        let esito;
        await act(async () => {
            esito = await result.current.moveStage(0, 1);
        });

        expect(esito).toEqual({ attempted: true, error: 'Errore salvataggio ordine' });
        expect(result.current.stages.map((stage) => stage.id)).toEqual(['s1', 's2']);
    });

    it('un riordino fuori dai bordi resta zitto', async () => {
        const { result } = renderActions();

        let esito;
        await act(async () => {
            esito = await result.current.moveStage(1, 1);
        });

        expect(esito).toEqual({ attempted: false, error: '' });
        expect(reorderStages).not.toHaveBeenCalled();
    });
});
