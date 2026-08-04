import { describe, expect, it } from 'vitest';
import { formatDateTime } from './adsFormatDateTime';
import { buildAdsInputCompleteness } from './buildAdsInputCompleteness';
import {
  applyFullAdsRegeneration,
  applyGeneratedGoogleAds,
  applyGeneratedMetaAds,
  applyGeneratedOperationalPlan,
} from './adsDraftReducers';
import { isAiUnavailable } from '../agencyProjectUx';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('formatDateTime', () => {
  // Si verifica solo la data: l'ora dipende dal fuso della macchina.
  it('formatta una data valida in italiano (giorno/mese/anno)', () => {
    expect(formatDateTime('2026-08-04T09:30:00.000Z')).toMatch(/^04\/08\/2026, /);
  });

  it('restituisce stringa vuota per valore assente', () => {
    expect(formatDateTime('')).toBe('');
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime(undefined)).toBe('');
  });

  it('restituisce il valore grezzo se non e\' una data (meglio del testo "Invalid Date")', () => {
    expect(formatDateTime('non una data')).toBe('non una data');
  });
});

describe('buildAdsInputCompleteness', () => {
  const inputCompleto = () => ({
    discovery: {
      sections: {
        target: 'PMI edili',
        offer: 'Consulenza a canone',
        technicalAspects: 'Tracking GA4 e pixel Meta gia\' installati',
        marketingAcquisition: 'Area geografica: Piemonte',
      },
    },
    web: { ctaPrimary: 'Prenota call', available: true },
  });

  it('con tutti i requisiti dichiara "completo" e tono positivo', () => {
    expect(buildAdsInputCompleteness(inputCompleto(), { source: 'agency' })).toEqual({
      label: 'completo',
      tone: 'success',
      missing: [],
    });
  });

  it.each([
    ['target', (i) => { i.discovery.sections.target = ' '; }],
    ['offerta', (i) => { i.discovery.sections.offer = ''; }],
    ['CTA', (i) => { i.web.ctaPrimary = ''; }],
    ['output web', (i) => { i.web.available = false; }],
  ])('segnala %s quando manca', (etichetta, rompi) => {
    const input = inputCompleto();
    rompi(input);

    const esito = buildAdsInputCompleteness(input, { source: 'agency' });

    expect(esito.missing).toEqual([etichetta]);
    expect(esito).toMatchObject({ label: 'input parziali', tone: 'warning' });
  });

  it('cerca il tracking per parole chiave nel testo libero, in qualsiasi forma', () => {
    const conPixel = inputCompleto();
    conPixel.discovery.sections.technicalAspects = 'Abbiamo il PIXEL di Meta';
    expect(buildAdsInputCompleteness(conPixel, {}).missing).not.toContain('tracking');

    const senza = inputCompleto();
    senza.discovery.sections.technicalAspects = 'Sito su WordPress';
    expect(buildAdsInputCompleteness(senza, {}).missing).toContain('tracking');
  });

  it('cerca l\'area geografica per parole chiave nel testo libero', () => {
    const senza = inputCompleto();
    senza.discovery.sections.marketingAcquisition = 'Passaparola e fiere';
    expect(buildAdsInputCompleteness(senza, {}).missing).toContain('area geografica');
  });

  it('la bozza solo locale vince sul conteggio: si dichiara anche a requisiti completi', () => {
    const esito = buildAdsInputCompleteness(inputCompleto(), { source: 'local_fallback' });

    expect(esito).toEqual({ label: 'bozza locale', tone: 'warning', missing: [] });
  });

  it('con input vuoto elenca tutti i requisiti, in ordine', () => {
    expect(buildAdsInputCompleteness(undefined, undefined).missing).toEqual([
      'target', 'offerta', 'CTA', 'output web', 'tracking', 'area geografica',
    ]);
  });
});

describe('isAiUnavailable', () => {
  it('e\' indisponibile solo quando il server lo dichiara', () => {
    expect(isAiUnavailable({ configured: false })).toBe(true);
    expect(isAiUnavailable({ status: 'not_configured' })).toBe(true);
    expect(isAiUnavailable({ configured: true, status: 'ready' })).toBe(false);
  });

  it('con stato ancora sconosciuto NON blocca (si prova comunque)', () => {
    expect(isAiUnavailable(null)).toBe(false);
    expect(isAiUnavailable(undefined)).toBe(false);
  });
});

describe('riduttori della bozza Ads', () => {
  const statoBase = () => ({
    lastUpdatedAt: '2026-08-01T10:00:00.000Z',
    input: { projectType: { key: 'ads_only' } },
    output: {
      channelScope: 'both',
      campaignGoal: 'lead_generation',
      notes: 'note mie',
      adCopyBlocks: { google: ['g vecchio'], meta: ['m vecchio'] },
      googleAds: { campaignType: '', adGroups: [], keywordSeeds: [] },
      metaAds: { campaignAngle: '', primaryTexts: [], assetRequests: [] },
      messageHooks: [],
      launchChecklist: [],
    },
  });

  const googleGenerato = {
    adCopyBlocks: { google: ['g nuovo'] },
    googleAds: { campaignType: 'search', adGroups: [{ name: 'AG1' }], keywordSeeds: ['kw'] },
  };
  const metaGenerato = {
    adCopyBlocks: { meta: ['m nuovo'] },
    metaAds: { campaignAngle: 'angolo', primaryTexts: ['p'], assetRequests: [] },
    messageHooks: ['hook'],
  };

  it('generare Google NON cancella il copy Meta gia\' presente', () => {
    const next = applyGeneratedGoogleAds(statoBase(), googleGenerato);

    expect(next.output.adCopyBlocks).toEqual({ google: ['g nuovo'], meta: ['m vecchio'] });
    expect(next.output.googleAds.campaignType).toBe('search');
    expect(next.output.notes).toBe('note mie');
    expect(next.output.lastGeneratedAt).toMatch(ISO);
  });

  it('generare Meta NON cancella il copy Google gia\' presente', () => {
    const next = applyGeneratedMetaAds(statoBase(), metaGenerato);

    expect(next.output.adCopyBlocks).toEqual({ google: ['g vecchio'], meta: ['m nuovo'] });
    expect(next.output.metaAds.campaignAngle).toBe('angolo');
    expect(next.output.messageHooks).toEqual(['hook']);
  });

  it('il piano operativo scrive solo quel che gli compete', () => {
    const next = applyGeneratedOperationalPlan(statoBase(), {
      launchChecklist: [{ key: 'k', label: 'Verifica pixel' }],
      assetRequests: ['banner 1080x1080'],
    });

    expect(next.output.launchChecklist).toHaveLength(1);
    expect(next.output.assetRequests).toEqual(['banner 1080x1080']);
    expect(next.output.adCopyBlocks).toEqual({ google: ['g vecchio'], meta: ['m vecchio'] });
    expect(next.output.lastGeneratedAt).toMatch(ISO);
  });

  it('la rigenerazione completa applica tutti e tre gli output e ricompone il copy dei due canali', () => {
    const next = applyFullAdsRegeneration(statoBase(), {
      googleOutput: googleGenerato,
      metaOutput: metaGenerato,
      operationalOutput: { launchChecklist: [{ key: 'k', label: 'Verifica' }] },
    });

    expect(next.output.adCopyBlocks).toEqual({ google: ['g nuovo'], meta: ['m nuovo'] });
    expect(next.output.googleAds.campaignType).toBe('search');
    expect(next.output.metaAds.campaignAngle).toBe('angolo');
    expect(next.output.messageHooks).toEqual(['hook']);
    expect(next.output.launchChecklist).toHaveLength(1);
    expect(next.output.lastGeneratedAt).toMatch(ISO);
  });

  it('non muta lo stato di partenza', () => {
    const stato = statoBase();
    applyGeneratedGoogleAds(stato, googleGenerato);

    expect(stato.output.adCopyBlocks.google).toEqual(['g vecchio']);
    expect(stato.output.lastGeneratedAt).toBeUndefined();
  });

  it.each([
    ['applyGeneratedGoogleAds', applyGeneratedGoogleAds, googleGenerato],
    ['applyGeneratedMetaAds', applyGeneratedMetaAds, metaGenerato],
    ['applyGeneratedOperationalPlan', applyGeneratedOperationalPlan, {}],
    ['applyFullAdsRegeneration', applyFullAdsRegeneration, { googleOutput: googleGenerato, metaOutput: metaGenerato, operationalOutput: {} }],
  ])('%s restituisce lo stato invariato se e\' null', (_nome, riduttore, payload) => {
    expect(riduttore(null, payload)).toBeNull();
  });
});
