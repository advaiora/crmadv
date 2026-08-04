import { describe, expect, it } from 'vitest';
import {
  applyGeneratedCopy,
  applyGeneratedPreview,
  applyGeneratedStructure,
  applyGeneratedWireframe,
  applyRegeneratedOutput,
} from './webDraftReducers';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Stato minimo ma realistico: `input` viene dalla Discovery, `output` e' cio'
// che l'utente ha gia' scritto o generato.
const statoBase = (overrides = {}) => ({
  lastUpdatedAt: '2026-08-01T10:00:00.000Z',
  input: {
    contextSummary: 'Contesto di progetto',
    discovery: {
      sections: {
        target: 'Target da Discovery',
        offer: 'Offerta da Discovery',
        projectGoal: 'Obiettivo da Discovery',
      },
    },
  },
  output: {
    pageType: 'landing',
    pageGoal: '',
    targetSummary: '',
    offerSummary: '',
    ctaSet: { primary: 'Prenota call' },
    sectionPlan: [],
    copyBlocks: { headline: '' },
    wireframe: { blocks: [] },
    previewHtmlBase: '',
    ...overrides,
  },
});

describe('applyGeneratedStructure', () => {
  it('scrive il section plan e riempie i campi di contesto dalla Discovery', () => {
    const next = applyGeneratedStructure(statoBase(), [{ key: 'hero', title: 'Hero' }]);

    expect(next.output.sectionPlan).toEqual([{ key: 'hero', title: 'Hero' }]);
    expect(next.output.targetSummary).toBe('Target da Discovery');
    expect(next.output.offerSummary).toBe('Offerta da Discovery');
    expect(next.output.pageGoal).toBe('Obiettivo da Discovery');
    expect(next.output.lastGeneratedAt).toMatch(ISO);
  });

  it('non sovrascrive i campi di contesto gia\' scritti a mano', () => {
    const stato = statoBase({
      pageGoal: 'Obiettivo mio',
      targetSummary: 'Target mio',
      offerSummary: 'Offerta mia',
    });

    const next = applyGeneratedStructure(stato, []);

    expect(next.output.pageGoal).toBe('Obiettivo mio');
    expect(next.output.targetSummary).toBe('Target mio');
    expect(next.output.offerSummary).toBe('Offerta mia');
  });

  it('ripiega su contextSummary quando la Discovery non ha un obiettivo', () => {
    const stato = statoBase();
    stato.input.discovery.sections.projectGoal = '';

    expect(applyGeneratedStructure(stato, []).output.pageGoal).toBe('Contesto di progetto');
  });

  it('lascia intatto cio\' che non tocca e non muta lo stato di partenza', () => {
    const stato = statoBase();
    const next = applyGeneratedStructure(stato, [{ key: 'hero' }]);

    expect(next.output.ctaSet).toEqual({ primary: 'Prenota call' });
    expect(next.lastUpdatedAt).toBe('2026-08-01T10:00:00.000Z');
    expect(stato.output.sectionPlan).toEqual([]);
    expect(stato.output.lastGeneratedAt).toBeUndefined();
  });
});

describe('applyGeneratedCopy', () => {
  it('fonde i blocchi di copy generati sull\'output esistente', () => {
    const next = applyGeneratedCopy(statoBase(), {
      copyBlocks: { headline: 'Headline generata', intro: 'Intro' },
    });

    expect(next.output.copyBlocks).toEqual({ headline: 'Headline generata', intro: 'Intro' });
    expect(next.output.pageType).toBe('landing');
    expect(next.output.lastGeneratedAt).toMatch(ISO);
  });
});

describe('applyGeneratedWireframe', () => {
  it('scrive solo il wireframe', () => {
    const next = applyGeneratedWireframe(statoBase(), { blocks: ['Hero', 'Benefici'] });

    expect(next.output.wireframe).toEqual({ blocks: ['Hero', 'Benefici'] });
    expect(next.output.previewHtmlBase).toBe('');
    expect(next.output.lastGeneratedAt).toMatch(ISO);
  });
});

describe('applyGeneratedPreview', () => {
  it('scrive solo la preview', () => {
    const next = applyGeneratedPreview(statoBase(), '<section>Hero</section>');

    expect(next.output.previewHtmlBase).toBe('<section>Hero</section>');
    expect(next.output.wireframe).toEqual({ blocks: [] });
    expect(next.output.lastGeneratedAt).toMatch(ISO);
  });
});

describe('applyRegeneratedOutput', () => {
  it('applica tutto l\'output generato', () => {
    const next = applyRegeneratedOutput(statoBase(), {
      sectionPlan: [{ key: 'hero' }],
      copyBlocks: { headline: 'H' },
      wireframe: { blocks: ['Hero'] },
      previewHtmlBase: '<p>x</p>',
    });

    expect(next.output.sectionPlan).toEqual([{ key: 'hero' }]);
    expect(next.output.copyBlocks).toEqual({ headline: 'H' });
    expect(next.output.wireframe).toEqual({ blocks: ['Hero'] });
    expect(next.output.previewHtmlBase).toBe('<p>x</p>');
    expect(next.output.lastGeneratedAt).toMatch(ISO);
  });

  it('i campi di contesto scritti a mano VINCONO su quelli generati', () => {
    const stato = statoBase({ pageGoal: 'Obiettivo mio', targetSummary: 'Target mio' });

    const next = applyRegeneratedOutput(stato, {
      pageGoal: 'Obiettivo generato',
      targetSummary: 'Target generato',
      offerSummary: 'Offerta generata',
    });

    expect(next.output.pageGoal).toBe('Obiettivo mio');
    expect(next.output.targetSummary).toBe('Target mio');
    // Qui l'utente non aveva scritto niente: vince la Discovery, non il generato.
    expect(next.output.offerSummary).toBe('Offerta da Discovery');
  });
});

describe('tutti i riduttori', () => {
  it.each([
    ['applyGeneratedStructure', applyGeneratedStructure],
    ['applyGeneratedCopy', applyGeneratedCopy],
    ['applyGeneratedWireframe', applyGeneratedWireframe],
    ['applyGeneratedPreview', applyGeneratedPreview],
    ['applyRegeneratedOutput', applyRegeneratedOutput],
  ])('%s restituisce lo stato invariato se e\' null (pagina in caricamento)', (_nome, riduttore) => {
    expect(riduttore(null, {})).toBeNull();
  });
});
