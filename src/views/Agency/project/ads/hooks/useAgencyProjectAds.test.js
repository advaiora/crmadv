import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  generateAgencyAdsAssetWithAi,
  getAgencyAiStatus,
  getAgencyProject,
  getAgencyProjectAds,
  getAgencyProjectWeb,
  saveAgencyProjectAds,
} from '../../../../../modules/agency-os/data/agencyDataAdapter';
import { useAgencyProjectAds } from './useAgencyProjectAds';

// Si finge solo il confine col server. I builder rule-based di agencyAdsRules
// girano davvero: e' cosi' che il test distingue una bozza generata in locale
// da una vera chiamata all'AI.
vi.mock('../../../../../modules/agency-os/data/agencyDataAdapter', () => ({
  getAgencyProject: vi.fn(),
  getAgencyProjectWeb: vi.fn(),
  getAgencyProjectAds: vi.fn(),
  getAgencyAiStatus: vi.fn(),
  getAgencyAiEstimates: vi.fn(),
  saveAgencyProjectAds: vi.fn(),
  generateAgencyAdsAssetWithAi: vi.fn(),
}));

vi.mock('../../../../../modules/agency-os/data/agencyDataSource', () => ({
  readAgencyDataMeta: (payload) => ({ source: payload?.persisted ? 'agency' : 'local_fallback' }),
}));

const payloadAds = (overrides = {}) => ({
  persisted: true,
  lastUpdatedAt: '2026-08-01T10:00:00.000Z',
  input: {
    projectType: { key: 'ads_only', label: 'Solo Ads' },
    scopePurchased: ['ads'],
    contextSummary: 'Contesto di progetto',
    activeModules: [{ label: 'Ads', active: true }],
    alerts: [],
    opportunities: [],
    discovery: {
      sections: {
        target: 'PMI edili',
        offer: 'Consulenza a canone',
        technicalAspects: 'Tracking GA4 attivo',
        marketingAcquisition: 'Area geografica Piemonte',
      },
    },
    web: {
      available: true,
      pageType: 'landing',
      pageGoal: 'Raccogliere richieste',
      ctaPrimary: 'Prenota call',
      offerSummary: 'Consulenza',
      targetSummary: 'PMI',
      landingRecommendationBase: '',
    },
  },
  output: {
    channelScope: 'both',
    campaignGoal: 'lead_generation',
    targetingSummary: '',
    offerAngle: '',
    notes: '',
    adsProjects: [],
    adCopyBlocks: { google: [], meta: [] },
    googleAds: { campaignType: '', campaignStructure: '', adGroups: [], keywordSeeds: [], negativeSeeds: [], extensionsIdeas: [], rsaIdeas: [], landingRecommendation: '' },
    metaAds: { campaignAngle: '', audienceIdeas: [], creativeAngles: [], hooks: [], primaryTexts: [], headlines: [], ctaIdeas: [], assetRequests: [] },
    messageHooks: [],
    launchChecklist: [],
    assetRequests: [],
    lastGeneratedAt: '',
    ...overrides,
  },
});

const progetto = { id: 'p1', sourceReadiness: { status: 'ready', usedSources: ['sito'] } };

const montaCaricato = async (payload = payloadAds()) => {
  getAgencyProjectAds.mockResolvedValue(payload);
  const utils = renderHook(() => useAgencyProjectAds('p1'));
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  return utils;
};

beforeEach(() => {
  vi.clearAllMocks();
  getAgencyProject.mockResolvedValue(progetto);
  getAgencyProjectWeb.mockResolvedValue({ output: { webProjects: [{ id: 'web_1', name: 'Landing consulenza' }] } });
  getAgencyAiStatus.mockResolvedValue({ configured: true, status: 'ready' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAgencyProjectAds — caricamento', () => {
  it('carica progetto, modulo Ads, landing disponibili e stato AI', async () => {
    const { result } = await montaCaricato();

    expect(getAgencyProjectAds).toHaveBeenCalledWith('p1');
    expect(result.current.webProjects).toEqual([{ id: 'web_1', name: 'Landing consulenza' }]);
    expect(result.current.aiStatus).toEqual({ configured: true, status: 'ready' });
    expect(result.current.aiUnavailable).toBe(false);
  });

  it('lo stato AI e\' gia\' noto quando il caricamento finisce (diverso dalla pagina Web)', async () => {
    const { result } = await montaCaricato();

    // Nessuna attesa in piu': se fosse fire-and-forget qui sarebbe ancora null.
    expect(result.current.aiStatus).not.toBeNull();
  });

  it('se il modulo Web non risponde, la pagina Ads carica lo stesso senza landing', async () => {
    getAgencyProjectWeb.mockRejectedValue(new Error('web non disponibile'));

    const { result } = await montaCaricato();

    expect(result.current.webProjects).toEqual([]);
    expect(result.current.saveError).toBe('');
  });

  it('mostra l\'errore di caricamento invece di lasciare la pagina muta', async () => {
    getAgencyProjectAds.mockRejectedValue(new Error('layer Agency non raggiungibile'));

    const { result } = renderHook(() => useAgencyProjectAds('p1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.saveError).toBe('layer Agency non raggiungibile');
  });

  it('calcola completezza e landing collegata anche prima che i dati arrivino', () => {
    getAgencyProjectAds.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAgencyProjectAds('p1'));

    expect(result.current.completeness.missing).toContain('target');
    expect(result.current.linkedLanding).toBe('Nessun output Web persistito');
  });

  it('a dati caricati la completezza e\' piena e la landing e\' descritta', async () => {
    const { result } = await montaCaricato();

    expect(result.current.completeness).toMatchObject({ label: 'completo', tone: 'success' });
    expect(result.current.linkedLanding).toBe('landing | Raccogliere richieste');
  });
});

describe('useAgencyProjectAds — salvataggio', () => {
  it('salva l\'output corrente e conferma', async () => {
    const { result } = await montaCaricato();
    saveAgencyProjectAds.mockResolvedValue({ ...payloadAds(), persisted: true });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(saveAgencyProjectAds).toHaveBeenCalledWith('p1', { output: expect.objectContaining({ channelScope: 'both' }) });
    expect(result.current.saveMessage).toBe('Output Ads salvato nel layer Agency.');
  });

  it('un salvataggio rimasto locale si vede anche nella completezza', async () => {
    const { result } = await montaCaricato();
    saveAgencyProjectAds.mockResolvedValue({ ...payloadAds(), persisted: false });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(result.current.saveMessage).toMatch(/salvato localmente/);
    expect(result.current.completeness.label).toBe('bozza locale');
  });
});

describe('useAgencyProjectAds — bozza base (senza AI)', () => {
  it('genera Google Ads senza chiedere conferma su output vuoto e senza chiamare l\'AI', async () => {
    const { result } = await montaCaricato();
    const conferma = vi.spyOn(window, 'confirm').mockReturnValue(true);

    act(() => {
      result.current.handleGenerateGoogleAds();
    });

    expect(conferma).not.toHaveBeenCalled();
    expect(result.current.output.googleAds.adGroups.length).toBeGreaterThan(0);
    expect(result.current.runtimeMessage).toMatch(/Bozza Google Ads generata/);
    expect(generateAgencyAdsAssetWithAi).not.toHaveBeenCalled();
  });

  it('con output Google gia\' presente chiede conferma e rispetta il no', async () => {
    const { result } = await montaCaricato(payloadAds({
      googleAds: { ...payloadAds().output.googleAds, campaignType: 'search' },
    }));
    const conferma = vi.spyOn(window, 'confirm').mockReturnValue(false);

    act(() => {
      result.current.handleGenerateGoogleAds();
    });

    expect(conferma).toHaveBeenCalled();
    expect(result.current.output.googleAds.campaignType).toBe('search');
    expect(result.current.output.googleAds.adGroups).toEqual([]);
  });

  it('generare Meta non tocca il copy Google gia\' generato', async () => {
    const { result } = await montaCaricato();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    act(() => {
      result.current.handleGenerateGoogleAds();
    });
    const copyGoogle = result.current.output.adCopyBlocks.google;
    expect(copyGoogle.length).toBeGreaterThan(0);

    act(() => {
      result.current.handleGenerateMetaAds();
    });

    expect(result.current.output.adCopyBlocks.google).toEqual(copyGoogle);
    expect(result.current.output.adCopyBlocks.meta.length).toBeGreaterThan(0);
  });

  it('il piano operativo produce la checklist di lancio', async () => {
    const { result } = await montaCaricato();

    act(() => {
      result.current.handleGenerateOperationalPlan();
    });

    expect(result.current.output.launchChecklist.length).toBeGreaterThan(0);
    expect(result.current.runtimeMessage).toMatch(/Checklist e richieste asset generate/);
  });

  it('la rigenerazione controllata chiede conferma SEMPRE, anche a output vuoto', async () => {
    const { result } = await montaCaricato();
    const conferma = vi.spyOn(window, 'confirm').mockReturnValue(false);

    act(() => {
      result.current.handleRegeneratePlaceholder();
    });

    expect(conferma).toHaveBeenCalledTimes(1);
    expect(result.current.output.googleAds.adGroups).toEqual([]);
  });

  it('confermata, la rigenerazione controllata riempie Google, Meta e checklist insieme', async () => {
    const { result } = await montaCaricato();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    act(() => {
      result.current.handleRegeneratePlaceholder();
    });

    expect(result.current.output.googleAds.adGroups.length).toBeGreaterThan(0);
    expect(result.current.output.metaAds.primaryTexts.length).toBeGreaterThan(0);
    expect(result.current.output.launchChecklist.length).toBeGreaterThan(0);
    expect(result.current.runtimeMessage).toMatch(/Output Ads rigenerato/);
  });
});

describe('useAgencyProjectAds — generazione AI per asset', () => {
  it('rigenera un asset e distingue il risultato riusato dalla cache', async () => {
    const { result } = await montaCaricato();
    generateAgencyAdsAssetWithAi.mockResolvedValue({ ...payloadAds(), aiGeneration: { cacheHit: true } });

    await act(async () => {
      await result.current.handleGenerateAdsAssetWithAi('headlines');
    });

    expect(generateAgencyAdsAssetWithAi).toHaveBeenCalledWith('p1', 'headlines');
    expect(result.current.runtimeMessage).toMatch(/nessuna nuova chiamata AI/);
    expect(result.current.generatingAssetKey).toBe('');
  });

  it('con AI non configurata non chiama l\'endpoint e propone le bozze base', async () => {
    getAgencyAiStatus.mockResolvedValue({ configured: false, status: 'not_configured' });
    const { result } = await montaCaricato();
    expect(result.current.aiUnavailable).toBe(true);

    await act(async () => {
      await result.current.handleGenerateAdsAssetWithAi('keywords');
    });

    expect(generateAgencyAdsAssetWithAi).not.toHaveBeenCalled();
    expect(result.current.runtimeMessage).toMatch(/AI non configurata/);
  });

  it('un errore dell\'endpoint viene mostrato e la pagina non resta in attesa', async () => {
    const { result } = await montaCaricato();
    generateAgencyAdsAssetWithAi.mockRejectedValue(new Error('quota esaurita'));

    await act(async () => {
      await result.current.handleGenerateAdsAssetWithAi('keywords');
    });

    expect(result.current.saveError).toBe('quota esaurita');
    expect(result.current.generatingAssetKey).toBe('');
  });
});

describe('useAgencyProjectAds — campagne', () => {
  it('aggiunge una campagna e ripulisce la bozza del form', async () => {
    const { result } = await montaCaricato();

    act(() => {
      result.current.setAdsProjectDraft((current) => ({ ...current, name: '  Search brand  ', goal: 'Lead', linkedWebProjectId: 'web_1' }));
    });
    act(() => {
      result.current.addAdsProject();
    });

    expect(result.current.output.adsProjects).toHaveLength(1);
    expect(result.current.output.adsProjects[0]).toMatchObject({
      name: 'Search brand',
      goal: 'Lead',
      channel: 'google',
      status: 'draft',
      linkedWebProjectId: 'web_1',
    });
    expect(result.current.adsProjectDraft.name).toBe('');
  });

  it('senza nome non aggiunge niente e spiega perche\'', async () => {
    const { result } = await montaCaricato();

    act(() => {
      result.current.addAdsProject();
    });

    expect(result.current.output.adsProjects).toHaveLength(0);
    expect(result.current.saveError).toBe('Inserisci un nome campagna/sub-progetto Ads.');
  });

  it('usare una campagna come contesto ne copia canale e angolo offerta', async () => {
    const { result } = await montaCaricato(payloadAds({
      adsProjects: [{ id: 'ads_1', name: 'Meta remarketing', channel: 'meta', goal: 'Recuperare i carrelli', status: 'draft' }],
    }));

    act(() => {
      result.current.generateForAdsProject(result.current.output.adsProjects[0]);
    });

    expect(result.current.output.channelScope).toBe('meta');
    expect(result.current.output.offerAngle).toBe('Recuperare i carrelli');
    expect(result.current.runtimeMessage).toMatch(/Meta remarketing/);
  });

  it('l\'obiettivo campagna NON viene aggiornato dal contesto (comportamento originale, annotato in roadmap)', async () => {
    const { result } = await montaCaricato(payloadAds({
      campaignGoal: 'lead_generation',
      adsProjects: [{ id: 'ads_1', name: 'C', channel: 'google', goal: 'sales', status: 'draft' }],
    }));

    act(() => {
      result.current.generateForAdsProject(result.current.output.adsProjects[0]);
    });

    expect(result.current.output.campaignGoal).toBe('lead_generation');
  });

  it('cambia lo stato di una campagna senza toccare le altre', async () => {
    const { result } = await montaCaricato(payloadAds({
      adsProjects: [
        { id: 'ads_1', name: 'A', channel: 'google', status: 'draft' },
        { id: 'ads_2', name: 'B', channel: 'meta', status: 'draft' },
      ],
    }));

    act(() => {
      result.current.updateAdsProjectStatus('ads_2', 'review');
    });

    expect(result.current.output.adsProjects.map((entry) => entry.status)).toEqual(['draft', 'review']);
  });

  it('non espone i setter grezzi dello stato', async () => {
    const { result } = await montaCaricato();

    expect(result.current.setAdsState).toBeUndefined();
    expect(result.current.setSaveError).toBeUndefined();
    expect(result.current.setRuntimeMessage).toBeUndefined();
  });
});
