import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  getChecklistTemplate,
  listChecklistAssignableUsers,
  listChecklistTemplates,
  listProjectChecklistInstances,
} from '../api/checklists.api';
import {
  useChecklistAssignableUsers,
  useChecklistTemplate,
  useChecklistTemplates,
  useProjectChecklistInstances,
} from './useChecklistsQueries';

// Modulo API finto: qui si misura la macchina a stati delle query, in
// particolare il CONTRATTO di refetch — la promessa risolve quando i dati
// sono arrivati, non quando la richiesta e' solo partita. E' il contratto
// su cui si appoggia la selezione del memo appena creato nella pagina
// Memo/Checklist (gemello del fix pipeline del 3/8/2026).
vi.mock('../api/checklists.api', () => ({
  archiveChecklistTemplate: vi.fn(),
  assignChecklistItem: vi.fn(),
  createChecklistTemplate: vi.fn(),
  createChecklistTemplateItem: vi.fn(),
  createProjectChecklistInstance: vi.fn(),
  ensureProjectStageChecklistInstances: vi.fn(),
  completeChecklistInstanceItem: vi.fn(),
  deleteChecklistTemplatePermanently: vi.fn(),
  deleteChecklistTemplateItem: vi.fn(),
  getChecklistTemplate: vi.fn(),
  listChecklistAssignableUsers: vi.fn(),
  listStageChecklistRules: vi.fn(),
  listChecklistTemplates: vi.fn(),
  listProjectChecklistInstances: vi.fn(),
  markChecklistItemNotApplicable: vi.fn(),
  replaceStageChecklistRules: vi.fn(),
  reorderChecklistTemplateItems: vi.fn(),
  resetChecklistItem: vi.fn(),
  updateChecklistItemState: vi.fn(),
  updateChecklistTemplate: vi.fn(),
  updateChecklistTemplateItem: vi.fn(),
  isApiError: () => false,
}));

beforeEach(() => {
  getChecklistTemplate.mockReset();
  listChecklistAssignableUsers.mockReset();
  listChecklistTemplates.mockReset();
  listProjectChecklistInstances.mockReset();
});

describe('useChecklistTemplates — refetch', () => {
  it('la promessa risolve quando i dati NUOVI sono arrivati, non prima', async () => {
    const consegne = [];
    listChecklistTemplates.mockImplementation(() => new Promise((resolve) => { consegne.push(resolve); }));

    const { result } = renderHook(() => useChecklistTemplates());

    await act(async () => {
      consegne[0]([{ id: 't1' }]);
    });
    expect(result.current.data).toEqual([{ id: 't1' }]);

    let risolta = false;
    let promessa;
    act(() => {
      promessa = result.current.refetch();
      promessa.then(() => { risolta = true; });
    });

    // La richiesta e' partita ma i dati non sono ancora arrivati: la
    // promessa deve restare in sospeso (prima del fix risolveva subito,
    // e la selezione del memo appena creato veniva scartata).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(risolta).toBe(false);
    expect(result.current.loading).toBe(true);

    await act(async () => {
      consegne[1]([{ id: 't1' }, { id: 't9' }]);
      await promessa;
    });
    expect(risolta).toBe(true);
    expect(result.current.data).toEqual([{ id: 't1' }, { id: 't9' }]);
  });

  // Attenzione al pattern: refetch va INNESCATO in un act sincrono e ATTESO
  // in un secondo act. Un solo `await act(async () => await refetch())` va
  // in stallo: l'effetto che risolve la promessa non parte finche' il
  // callback non finisce, e il callback aspetta la promessa.
  it('anche su errore la promessa risolve (niente attese appese), con lo stato di errore', async () => {
    listChecklistTemplates.mockResolvedValueOnce([{ id: 't1' }]).mockRejectedValueOnce(new Error('rete giu'));

    const { result } = renderHook(() => useChecklistTemplates());
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

describe('useChecklistTemplate — refetch', () => {
  it('la promessa risolve quando il dettaglio aggiornato e\' arrivato', async () => {
    const consegne = [];
    getChecklistTemplate.mockImplementation(() => new Promise((resolve) => { consegne.push(resolve); }));

    const { result } = renderHook(() => useChecklistTemplate('tpl-1'));

    await act(async () => {
      consegne[0]({ id: 'tpl-1', name: 'Onboarding' });
    });
    expect(result.current.data).toEqual({ id: 'tpl-1', name: 'Onboarding' });

    let risolta = false;
    let promessa;
    act(() => {
      promessa = result.current.refetch();
      promessa.then(() => { risolta = true; });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(risolta).toBe(false);

    await act(async () => {
      consegne[1]({ id: 'tpl-1', name: 'Onboarding v2' });
      await promessa;
    });
    expect(risolta).toBe(true);
    expect(result.current.data).toEqual({ id: 'tpl-1', name: 'Onboarding v2' });
  });

  it('senza templateId la promessa risolve subito e lo stato resta a riposo', async () => {
    const { result } = renderHook(() => useChecklistTemplate(''));

    let promessa;
    act(() => {
      promessa = result.current.refetch();
    });
    await act(async () => {
      await promessa;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(getChecklistTemplate).not.toHaveBeenCalled();
  });
});

describe('useProjectChecklistInstances — refetch a query spenta', () => {
  it('senza projectId la promessa risolve subito e lo stato resta a riposo', async () => {
    const { result } = renderHook(() => useProjectChecklistInstances(undefined));

    let promessa;
    act(() => {
      promessa = result.current.refetch();
    });
    await act(async () => {
      await promessa;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(listProjectChecklistInstances).not.toHaveBeenCalled();
  });
});

describe('useChecklistAssignableUsers — refetch a query spenta', () => {
  it('con enabled falso la promessa risolve subito senza chiamare l\'API', async () => {
    const { result } = renderHook(() => useChecklistAssignableUsers({ enabled: false }));

    let promessa;
    act(() => {
      promessa = result.current.refetch();
    });
    await act(async () => {
      await promessa;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([]);
    expect(listChecklistAssignableUsers).not.toHaveBeenCalled();
  });

  // Il caso vivo e' ChecklistTemplates: enabled = canManageTemplates. Se il
  // ramo disabilitato smettesse di azzerare lo stato (tornando alla vecchia
  // maschera), i dati vecchi resterebbero esposti: questo test lo inchioda.
  it('spegnendo la query a caldo lo stato torna a riposo', async () => {
    listChecklistAssignableUsers.mockResolvedValueOnce([{ id: 'u1' }]);

    const { result, rerender } = renderHook(
      ({ enabled }) => useChecklistAssignableUsers({ enabled }),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'u1' }]));

    rerender({ enabled: false });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([]);
  });
});
