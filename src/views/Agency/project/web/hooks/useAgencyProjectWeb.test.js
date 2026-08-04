import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  generateAgencyWebBlockWithAi,
  generateAgencyWebProjectWithAi,
  getAgencyAiStatus,
  getAgencyProject,
  getAgencyProjectWeb,
  saveAgencyProjectWeb,
} from '../../../../../modules/agency-os/data/agencyDataAdapter';
import { useAgencyProjectWeb } from './useAgencyProjectWeb';

// Si finge solo il confine con il server (adapter + lettura meta). I builder
// rule-based di agencyWebRules girano per davvero: e' proprio il punto del
// test distinguere "bozza base generata in locale" da "chiamata all'AI".
vi.mock('../../../../../modules/agency-os/data/agencyDataAdapter', () => ({
  getAgencyProject: vi.fn(),
  getAgencyProjectWeb: vi.fn(),
  getAgencyAiStatus: vi.fn(),
  getAgencyAiEstimates: vi.fn(),
  saveAgencyProjectWeb: vi.fn(),
  generateAgencyWebProjectWithAi: vi.fn(),
  generateAgencyWebBlockWithAi: vi.fn(),
}));

vi.mock('../../../../../modules/agency-os/data/agencyDataSource', () => ({
  readAgencyDataMeta: (payload) => ({ source: payload?.persisted ? 'agency' : 'local' }),
}));

const payloadWeb = (overrides = {}) => ({
  persisted: true,
  lastUpdatedAt: '2026-08-01T10:00:00.000Z',
  input: {
    projectType: { key: 'marketing_full', label: 'Marketing completo' },
    scopePurchased: ['landing'],
    contextSummary: 'Contesto di progetto',
    discovery: {
      sections: {
        target: 'PMI del settore edile',
        offer: 'Consulenza a canone',
        projectGoal: 'Generare richieste di preventivo',
        brandCommunication: 'Garanzia sui lead',
        availableMaterials: 'Case study 2025',
      },
    },
  },
  output: {
    pageType: 'landing',
    pageGoal: '',
    targetSummary: '',
    offerSummary: '',
    valueProp: '',
    ctaSet: { primary: 'Prenota call' },
    sectionPlan: [],
    copyBlocks: {},
    wireframe: { blocks: [] },
    previewHtmlBase: '',
    webProjects: [],
    ...overrides,
  },
});

const progetto = { id: 'p1', sourceReadiness: { status: 'ready', usedSources: ['sito cliente'] } };

// Monta l'hook e aspetta la fine del caricamento iniziale.
const montaCaricato = async (payload = payloadWeb()) => {
  getAgencyProjectWeb.mockResolvedValue(payload);
  const utils = renderHook(() => useAgencyProjectWeb('p1'));
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  return utils;
};

beforeEach(() => {
  vi.clearAllMocks();
  getAgencyProject.mockResolvedValue(progetto);
  getAgencyAiStatus.mockResolvedValue({ configured: true, status: 'ready' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAgencyProjectWeb — caricamento', () => {
  it('carica progetto, modulo Web e stato AI al montaggio', async () => {
    const { result } = await montaCaricato();

    expect(getAgencyProjectWeb).toHaveBeenCalledWith('p1');
    expect(result.current.output.pageType).toBe('landing');
    expect(result.current.dataMeta).toEqual({ source: 'agency' });
    await waitFor(() => expect(result.current.aiStatus).toEqual({ configured: true, status: 'ready' }));
    expect(result.current.aiUnavailable).toBe(false);
  });

  it('mostra l\'errore di caricamento invece di lasciare la pagina muta', async () => {
    getAgencyProjectWeb.mockRejectedValue(new Error('layer Agency non raggiungibile'));

    const { result } = renderHook(() => useAgencyProjectWeb('p1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.saveError).toBe('layer Agency non raggiungibile');
  });

  it('calcola i dati mancanti e le fonti usate anche prima che i dati arrivino', async () => {
    getAgencyProjectWeb.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAgencyProjectWeb('p1'));

    expect(result.current.webMissingInputs).toContain('target');
    expect(result.current.usedSources).toEqual([]);
  });

  it('a dati caricati non segnala niente di mancante e riporta le fonti', async () => {
    const { result } = await montaCaricato();

    expect(result.current.webMissingInputs).toEqual([]);
    expect(result.current.usedSources).toEqual(['sito cliente']);
  });
});

describe('useAgencyProjectWeb — salvataggio', () => {
  it('salva l\'output corrente e conferma', async () => {
    const { result } = await montaCaricato();
    saveAgencyProjectWeb.mockResolvedValue({ ...payloadWeb(), persisted: true });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(saveAgencyProjectWeb).toHaveBeenCalledWith('p1', { output: expect.objectContaining({ pageType: 'landing' }) });
    expect(result.current.saveMessage).toBe('Output Web salvato nel layer Agency.');
    expect(result.current.saving).toBe(false);
  });

  it('avvisa quando il salvataggio e\' rimasto solo locale', async () => {
    const { result } = await montaCaricato();
    saveAgencyProjectWeb.mockResolvedValue({ ...payloadWeb(), persisted: false });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.saveMessage).toMatch(/salvato localmente/);
  });
});

describe('useAgencyProjectWeb — bozza base (senza AI)', () => {
  it('handleGenerateStructure popola il section plan senza chiamare l\'AI', async () => {
    const { result } = await montaCaricato();

    act(() => {
      result.current.handleGenerateStructure();
    });

    expect(result.current.output.sectionPlan.length).toBeGreaterThan(0);
    expect(result.current.output.targetSummary).toBe('PMI del settore edile');
    expect(result.current.generationMessage).toMatch(/Struttura pagina generata/);
    expect(generateAgencyWebProjectWithAi).not.toHaveBeenCalled();
    expect(generateAgencyWebBlockWithAi).not.toHaveBeenCalled();
  });

  it('handleRegenerateAll chiede conferma se c\'e\' gia\' output, e rispetta il no', async () => {
    const { result } = await montaCaricato(payloadWeb({ sectionPlan: [{ key: 'hero', title: 'Hero' }] }));
    const conferma = vi.spyOn(window, 'confirm').mockReturnValue(false);

    act(() => {
      result.current.handleRegenerateAll();
    });

    expect(conferma).toHaveBeenCalled();
    expect(result.current.output.sectionPlan).toEqual([{ key: 'hero', title: 'Hero' }]);
    expect(result.current.output.copyBlocks).toEqual({});
  });

  it('handleRegenerateAll non chiede conferma su una pagina ancora vuota', async () => {
    const { result } = await montaCaricato();
    const conferma = vi.spyOn(window, 'confirm').mockReturnValue(true);

    act(() => {
      result.current.handleRegenerateAll();
    });

    expect(conferma).not.toHaveBeenCalled();
    expect(result.current.output.sectionPlan.length).toBeGreaterThan(0);
    expect(result.current.generationMessage).toMatch(/Bozza Web rigenerata/);
  });
});

describe('useAgencyProjectWeb — generazione AI', () => {
  it('genera la pagina con AI usando il primo sub-progetto', async () => {
    const { result } = await montaCaricato(payloadWeb({
      webProjects: [{ id: 'web_1', name: 'Landing consulenza', type: 'landing', status: 'draft' }],
    }));
    generateAgencyWebProjectWithAi.mockResolvedValue({
      ...payloadWeb(),
      aiGeneration: { generated: true },
    });

    await act(async () => {
      await result.current.handleGenerateWithAi();
    });

    expect(generateAgencyWebProjectWithAi).toHaveBeenCalledWith('p1', 'web_1');
    expect(result.current.generationMessage).toMatch(/generato con AI/);
    expect(result.current.generatingAi).toBe(false);
  });

  it('senza nessuna pagina creata non chiama l\'AI e lo dice', async () => {
    const { result } = await montaCaricato();

    await act(async () => {
      await result.current.handleGenerateWithAi();
    });

    expect(generateAgencyWebProjectWithAi).not.toHaveBeenCalled();
    expect(result.current.saveError).toMatch(/Crea prima una landing/);
  });

  it('con AI non configurata non chiama l\'endpoint e propone la bozza base', async () => {
    getAgencyAiStatus.mockResolvedValue({ configured: false, status: 'not_configured' });
    const { result } = await montaCaricato(payloadWeb({
      webProjects: [{ id: 'web_1', name: 'Landing', type: 'landing', status: 'draft' }],
    }));
    await waitFor(() => expect(result.current.aiUnavailable).toBe(true));

    await act(async () => {
      await result.current.handleGenerateWithAi();
    });

    expect(generateAgencyWebProjectWithAi).not.toHaveBeenCalled();
    expect(result.current.generationMessage).toMatch(/AI non configurata/);
  });

  it('rigenera un singolo blocco e distingue il risultato riusato dalla cache', async () => {
    const { result } = await montaCaricato(payloadWeb({
      webProjects: [{ id: 'web_1', name: 'Landing', type: 'landing', status: 'draft' }],
    }));
    generateAgencyWebBlockWithAi.mockResolvedValue({
      ...payloadWeb(),
      aiGeneration: { cacheHit: true },
    });

    await act(async () => {
      await result.current.handleGenerateBlockWithAi('hero');
    });

    expect(generateAgencyWebBlockWithAi).toHaveBeenCalledWith('p1', 'web_1', 'hero');
    expect(result.current.generationMessage).toMatch(/nessuna nuova chiamata AI/);
    expect(result.current.generatingBlockKey).toBe('');
  });
});

describe('useAgencyProjectWeb — sub-progetti', () => {
  it('aggiunge una pagina e ripulisce la bozza del form', async () => {
    const { result } = await montaCaricato();

    act(() => {
      result.current.setWebProjectDraft((current) => ({ ...current, name: '  Landing consulenza  ', goal: 'Lead' }));
    });
    act(() => {
      result.current.addWebProject();
    });

    expect(result.current.output.webProjects).toHaveLength(1);
    expect(result.current.output.webProjects[0]).toMatchObject({
      name: 'Landing consulenza',
      goal: 'Lead',
      type: 'landing',
      status: 'draft',
    });
    expect(result.current.webProjectDraft.name).toBe('');
  });

  it('senza nome non aggiunge niente e spiega perche\'', async () => {
    const { result } = await montaCaricato();

    act(() => {
      result.current.addWebProject();
    });

    expect(result.current.output.webProjects).toHaveLength(0);
    expect(result.current.saveError).toBe('Inserisci un nome sub-progetto Web.');
  });

  it('usare una pagina come contesto corrente ne copia tipo, goal, target e CTA', async () => {
    const { result } = await montaCaricato(payloadWeb({
      webProjects: [{
        id: 'web_1',
        name: 'Scheda prodotto',
        type: 'ecommerce_page',
        goal: 'Vendere il kit',
        target: 'Ristoratori',
        primaryCta: 'Acquista ora',
        status: 'draft',
      }],
    }));

    act(() => {
      result.current.generateForWebProject(result.current.output.webProjects[0]);
    });

    expect(result.current.output.pageType).toBe('ecommerce_lite');
    expect(result.current.output.pageGoal).toBe('Vendere il kit');
    expect(result.current.output.targetSummary).toBe('Ristoratori');
    expect(result.current.output.ctaSet.primary).toBe('Acquista ora');
    expect(result.current.generationMessage).toMatch(/Scheda prodotto/);
  });

  it('cambia lo stato di una pagina senza toccare le altre', async () => {
    const { result } = await montaCaricato(payloadWeb({
      webProjects: [
        { id: 'web_1', name: 'A', type: 'landing', status: 'draft' },
        { id: 'web_2', name: 'B', type: 'landing', status: 'draft' },
      ],
    }));

    act(() => {
      result.current.updateWebProjectStatus('web_2', 'review');
    });

    expect(result.current.output.webProjects.map((entry) => entry.status)).toEqual(['draft', 'review']);
  });
});
