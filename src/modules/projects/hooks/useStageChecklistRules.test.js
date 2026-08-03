import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { listStageChecklistRules, replaceStageChecklistRules } from '../../checklists/api/checklists.api';
import { useStageChecklistRules } from './useStageChecklistRules';

// L'hook parla col backend: qui il modulo API e' finto, cosi' il test misura
// la macchina a stati (una bozza per stage, errori isolati, salvataggio) e non
// la rete. `vi.mock` viene issato sopra gli import, quindi l'hook riceve
// gia' la versione finta.
vi.mock('../../checklists/api/checklists.api', () => ({
    listStageChecklistRules: vi.fn(),
    replaceStageChecklistRules: vi.fn(),
    isApiError: () => false,
}));

const stages = [{ id: 's1' }, { id: 's2' }];

const render = (overrides = {}) =>
    renderHook((props) => useStageChecklistRules(props), {
        initialProps: { categoryId: 'c1', stages, enabled: true, ...overrides },
    });

beforeEach(() => {
    listStageChecklistRules.mockReset();
    replaceStageChecklistRules.mockReset();
});

describe('useStageChecklistRules', () => {
    it('carica una bozza per stage e considera acceso il gate assente', async () => {
        listStageChecklistRules.mockImplementation(async (_categoryId, stageId) => ({
            items: stageId === 's1' ? [{ checklistTemplateId: 't1' }] : [{ checklistTemplateId: 't2', gateEnabled: false }],
        }));

        const { result } = render();

        await waitFor(() => expect(result.current.rulesByStageId.s1?.loading).toBe(false));
        await waitFor(() => expect(result.current.rulesByStageId.s2?.loading).toBe(false));

        expect(result.current.rulesByStageId.s1.rules).toEqual([{ checklistTemplateId: 't1', gateEnabled: true }]);
        expect(result.current.rulesByStageId.s2.rules).toEqual([{ checklistTemplateId: 't2', gateEnabled: false }]);
    });

    it('uno stage che va in errore non spegne gli altri', async () => {
        listStageChecklistRules.mockImplementation(async (_categoryId, stageId) => {
            if (stageId === 's1') {
                throw new Error('boom');
            }
            return { items: [{ checklistTemplateId: 't2', gateEnabled: true }] };
        });

        const { result } = render();

        await waitFor(() => expect(result.current.rulesByStageId.s1?.error).toBe('boom'));
        expect(result.current.rulesByStageId.s1.rules).toEqual([]);
        await waitFor(() => expect(result.current.rulesByStageId.s2?.rules).toHaveLength(1));
    });

    it('senza permesso, senza categoria o senza stage non chiama il backend', () => {
        listStageChecklistRules.mockResolvedValue({ items: [] });

        const senzaPermesso = render({ enabled: false });
        const senzaCategoria = render({ categoryId: '' });
        const senzaStage = render({ stages: [] });

        expect(senzaPermesso.result.current.rulesByStageId).toEqual({});
        expect(senzaCategoria.result.current.rulesByStageId).toEqual({});
        expect(senzaStage.result.current.rulesByStageId).toEqual({});
        expect(listStageChecklistRules).not.toHaveBeenCalled();
    });

    it("perdere il permesso azzera le bozze gia' caricate", async () => {
        listStageChecklistRules.mockResolvedValue({ items: [{ checklistTemplateId: 't1', gateEnabled: true }] });

        const { result, rerender } = render();
        await waitFor(() => expect(result.current.rulesByStageId.s1?.rules).toHaveLength(1));

        rerender({ categoryId: 'c1', stages, enabled: false });
        expect(result.current.rulesByStageId).toEqual({});
    });

    it('spuntare un template e spegnerne il gate cambiano solo lo stage indicato', async () => {
        listStageChecklistRules.mockResolvedValue({ items: [] });

        const { result } = render();
        await waitFor(() => expect(result.current.rulesByStageId.s1?.loading).toBe(false));

        act(() => result.current.toggleTemplate('s1', 't1', true));
        expect(result.current.rulesByStageId.s1.rules).toEqual([{ checklistTemplateId: 't1', gateEnabled: true }]);
        expect(result.current.rulesByStageId.s2.rules).toEqual([]);

        act(() => result.current.toggleGate('s1', 't1', false));
        expect(result.current.rulesByStageId.s1.rules).toEqual([{ checklistTemplateId: 't1', gateEnabled: false }]);
    });

    it('il salvataggio riuscito si dichiara fatto e ricarica la bozza dalla risposta', async () => {
        listStageChecklistRules.mockResolvedValue({ items: [] });
        replaceStageChecklistRules.mockResolvedValue({ items: [{ checklistTemplateId: 't9' }] });

        const { result } = render();
        await waitFor(() => expect(result.current.rulesByStageId.s1?.loading).toBe(false));

        act(() => result.current.toggleTemplate('s1', 't1', true));

        let esito;
        await act(async () => {
            esito = await result.current.saveRules('s1');
        });

        expect(esito).toEqual({ attempted: true, error: '' });
        expect(replaceStageChecklistRules).toHaveBeenCalledWith('c1', 's1', [{ checklistTemplateId: 't1', gateEnabled: true }]);
        expect(result.current.rulesByStageId.s1.rules).toEqual([{ checklistTemplateId: 't9', gateEnabled: true }]);
        expect(result.current.rulesByStageId.s1.saving).toBe(false);
    });

    it('il salvataggio fallito si dichiara fatto, col messaggio, e lo lascia anche nella bozza', async () => {
        listStageChecklistRules.mockResolvedValue({ items: [] });
        replaceStageChecklistRules.mockRejectedValue(new Error('salvataggio rotto'));

        const { result } = render();
        await waitFor(() => expect(result.current.rulesByStageId.s1?.loading).toBe(false));

        let esito;
        await act(async () => {
            esito = await result.current.saveRules('s1');
        });

        expect(esito).toEqual({ attempted: true, error: 'salvataggio rotto' });
        expect(result.current.rulesByStageId.s1.error).toBe('salvataggio rotto');
        expect(result.current.rulesByStageId.s1.saving).toBe(false);
    });

    it('senza permesso il salvataggio non parte, e non si spaccia per riuscito', async () => {
        const { result } = render({ enabled: false });

        let esito;
        await act(async () => {
            esito = await result.current.saveRules('s1');
        });

        // Il chiamante distingue "non partito" da "salvato": e' la differenza
        // fra restare zitti e annunciare un salvataggio mai avvenuto.
        expect(esito).toEqual({ attempted: false, error: '' });
        expect(replaceStageChecklistRules).not.toHaveBeenCalled();
    });
});
