import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  deleteAgencyProjectSourceFile,
  getAgencyProjectSources,
  saveAgencyProjectSources,
  searchAgencyProjectCompetitors,
  uploadAgencyProjectSourceFile,
} from '../../../../../modules/agency-os/data/agencyDataAdapter';
import { useAgencyProjectAssets } from './useAgencyProjectAssets';

// Si finge solo il confine col server. Le funzioni pure (fusione competitor,
// validazione URL, etichette) girano davvero: sono gia' coperte a parte, ma
// qui servono vere per vedere l'effetto che fanno sullo stato.
vi.mock('../../../../../modules/agency-os/data/agencyDataAdapter', () => ({
  getAgencyProjectSources: vi.fn(),
  saveAgencyProjectSources: vi.fn(),
  deleteAgencyProjectSourceFile: vi.fn(),
  fetchAgencyProjectSourceFileBlob: vi.fn(),
  uploadAgencyProjectSourceFile: vi.fn(),
  searchAgencyProjectCompetitors: vi.fn(),
}));

vi.mock('../../../../../modules/agency-os/data/agencyDataSource', () => ({
  readAgencyDataMeta: (payload) => ({ source: payload?.persisted ? 'agency' : 'local_fallback' }),
}));

const payloadFonti = (overrides = {}) => ({
  persisted: true,
  sourceStatus: 'partial',
  sourceSummary: 'Sito principale registrato.',
  primaryWebsiteUrl: 'https://cliente.it',
  websiteUrl: 'https://cliente.it',
  manualNotes: 'Note iniziali',
  urls: [
    { id: 'url_1', label: 'Sito', type: 'website', url: 'https://cliente.it', status: 'active', notes: '' },
  ],
  uploadedFiles: [],
  competitors: [],
  competitorUrls: [],
  ...overrides,
});

const montaHook = async () => {
  const risultato = renderHook(() => useAgencyProjectAssets('p1'));
  await waitFor(() => expect(risultato.result.current.loading).toBe(false));
  return risultato;
};

beforeEach(() => {
  vi.clearAllMocks();
  getAgencyProjectSources.mockResolvedValue(payloadFonti());
});

describe('caricamento', () => {
  it('carica fonti, casella competitor e provenienza dei dati', async () => {
    getAgencyProjectSources.mockResolvedValue(payloadFonti({
      competitorUrls: ['https://rivale1.it', 'https://rivale2.it'],
    }));

    const { result } = await montaHook();

    expect(result.current.sources.primaryWebsiteUrl).toBe('https://cliente.it');
    expect(result.current.competitorUrlsText).toBe('https://rivale1.it\nhttps://rivale2.it');
    expect(result.current.dataMeta).toEqual({ source: 'agency' });
    expect(result.current.status).toBe('partial');
  });

  it('se il caricamento fallisce mostra un errore leggibile e smette di caricare', async () => {
    getAgencyProjectSources.mockRejectedValue(new Error('Invalid Agency project sources payload'));

    const { result } = await montaHook();

    expect(result.current.error).toMatch(/non sono nel formato previsto/);
    expect(result.current.sources).toBeNull();
  });

  it('nasconde i setter dello stato condiviso ed espone solo quelli delle bozze', async () => {
    const { result } = await montaHook();

    for (const nascosto of ['setSources', 'setError', 'setMessage', 'setSaving', 'setDataMeta']) {
      expect(result.current[nascosto]).toBeUndefined();
    }
    // Questi tre alimentano campi di testo libero senza una funzione
    // dedicata: toglierli romperebbe quei campi.
    for (const pubblico of ['setCompetitorUrlsText', 'setFileDraft', 'setCompetitorDraft']) {
      expect(typeof result.current[pubblico]).toBe('function');
    }
  });
});

describe('indirizzi', () => {
  it('aggiunge una riga vuota da compilare', async () => {
    const { result } = await montaHook();

    act(() => result.current.addUrlSource());

    expect(result.current.sources.urls).toHaveLength(2);
    expect(result.current.sources.urls[1]).toMatchObject({ url: '', type: 'other', status: 'active' });
  });

  it('rimuovendo il sito principale ne rielegge un altro invece di lasciare il campo appeso', async () => {
    getAgencyProjectSources.mockResolvedValue(payloadFonti({
      urls: [
        { id: 'url_1', type: 'website', url: 'https://cliente.it', status: 'active' },
        { id: 'url_2', type: 'landing', url: 'https://landing.it', status: 'active' },
      ],
    }));
    const { result } = await montaHook();

    act(() => result.current.removeUrlSource('url_1'));

    expect(result.current.sources.primaryWebsiteUrl).toBe('https://landing.it');
    expect(result.current.sources.websiteUrl).toBe('https://landing.it');
  });

  it('impostare il sito principale allinea i due campi e marca la riga come website', async () => {
    getAgencyProjectSources.mockResolvedValue(payloadFonti({
      urls: [{ id: 'url_2', type: 'landing', url: 'https://landing.it', status: 'ignored' }],
    }));
    const { result } = await montaHook();

    act(() => result.current.setPrimaryUrlSource({ id: 'url_2', url: 'https://landing.it' }));

    expect(result.current.sources.primaryWebsiteUrl).toBe('https://landing.it');
    expect(result.current.sources.websiteUrl).toBe('https://landing.it');
    expect(result.current.sources.urls[0]).toMatchObject({ type: 'website', status: 'active' });
  });

  it('su una riga senza indirizzo rifiuta di impostare il sito principale', async () => {
    const { result } = await montaHook();

    act(() => result.current.setPrimaryUrlSource({ id: 'url_1', url: '   ' }));

    expect(result.current.error).toMatch(/Inserisci l'URL prima/);
  });
});

describe('materiali', () => {
  it('aggiunge un materiale senza file e ripulisce la bozza', async () => {
    const { result } = await montaHook();

    act(() => result.current.setFileDraft({ name: 'Brochure.pdf', type: 'pdf', notes: 'Cartacea' }));
    act(() => result.current.addFileMetadata());

    expect(result.current.uploadedFiles).toHaveLength(1);
    expect(result.current.uploadedFiles[0]).toMatchObject({ name: 'Brochure.pdf', status: 'metadata_only' });
    expect(result.current.fileDraft).toEqual({ name: '', type: '', notes: '' });
  });

  it('senza nome file non aggiunge niente e lo dice', async () => {
    const { result } = await montaHook();

    act(() => result.current.addFileMetadata());

    expect(result.current.uploadedFiles).toHaveLength(0);
    expect(result.current.error).toMatch(/Inserisci almeno il nome file/);
  });

  it('rimuovendo un file caricato risincronizza fonti, casella competitor e provenienza insieme', async () => {
    getAgencyProjectSources.mockResolvedValue(payloadFonti({
      uploadedFiles: [{ id: 'file_1', name: 'brief.pdf', storagePath: 'storage/brief.pdf' }],
    }));
    deleteAgencyProjectSourceFile.mockResolvedValue(payloadFonti({
      persisted: false,
      uploadedFiles: [],
      competitorUrls: ['https://rivale.it'],
    }));
    const { result } = await montaHook();

    await act(async () => { await result.current.removeFile({ id: 'file_1', storagePath: 'storage/brief.pdf' }); });

    expect(result.current.uploadedFiles).toHaveLength(0);
    expect(result.current.competitorUrlsText).toBe('https://rivale.it');
    expect(result.current.dataMeta).toEqual({ source: 'local_fallback' });
    expect(result.current.message).toBe('File caricato rimosso.');
  });

  it('rimuovendo un materiale senza file non chiama il server', async () => {
    getAgencyProjectSources.mockResolvedValue(payloadFonti({
      uploadedFiles: [{ id: 'file_1', name: 'Brochure', status: 'metadata_only' }],
    }));
    const { result } = await montaHook();

    await act(async () => { await result.current.removeFile({ id: 'file_1' }); });

    expect(deleteAgencyProjectSourceFile).not.toHaveBeenCalled();
    expect(result.current.uploadedFiles).toHaveLength(0);
  });

  it('con la coda vuota non carica niente e lo dice', async () => {
    const { result } = await montaHook();

    await act(async () => { await result.current.uploadQueuedFiles(); });

    expect(uploadAgencyProjectSourceFile).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/Aggiungi almeno un file valido/);
  });
});

describe('competitor', () => {
  it('aggiunge un competitor manuale ricavando il nome dal dominio', async () => {
    const { result } = await montaHook();

    act(() => result.current.setCompetitorDraft({ name: '', url: 'https://www.rivale.it', reason: '' }));
    act(() => result.current.addManualCompetitor());

    expect(result.current.competitorRoster).toHaveLength(1);
    expect(result.current.competitorRoster[0]).toMatchObject({
      name: 'rivale.it',
      source: 'manual',
      status: 'confirmed',
      reason: 'Inserito manualmente.',
    });
    expect(result.current.competitorDraft).toEqual({ name: '', url: '', reason: '' });
  });

  it('senza indirizzo non aggiunge il competitor manuale', async () => {
    const { result } = await montaHook();

    act(() => result.current.addManualCompetitor());

    expect(result.current.competitorRoster).toHaveLength(0);
    expect(result.current.error).toMatch(/Inserisci almeno l'URL competitor/);
  });

  it('confermando un suggerimento AI lo marca confermato e invita a salvare', async () => {
    const { result } = await montaHook();

    act(() => result.current.addSuggestedCompetitor({ id: 'sug_1', name: 'Rivale', url: 'https://rivale.it' }));

    expect(result.current.competitorRoster[0]).toMatchObject({ id: 'sug_1', status: 'confirmed', source: 'ai_search' });
    expect(result.current.message).toMatch(/Salva le fonti per renderlo permanente/);
  });

  it('la ricerca online riuscita riempie i suggerimenti e il messaggio', async () => {
    searchAgencyProjectCompetitors.mockResolvedValue({
      realSearch: true,
      message: 'Trovati 2 competitor.',
      suggestions: [{ id: 's1', url: 'https://a.it' }, { id: 's2', url: 'https://b.it' }],
    });
    const { result } = await montaHook();

    await act(async () => { await result.current.runCompetitorSearch(); });

    expect(result.current.competitorSearchSuggestions).toHaveLength(2);
    expect(result.current.message).toBe('Trovati 2 competitor.');
    expect(result.current.searching).toBe(false);
  });

  it('la ricerca non configurata non e\' un errore: resta un messaggio', async () => {
    searchAgencyProjectCompetitors.mockResolvedValue({ realSearch: false, suggestions: [] });
    const { result } = await montaHook();

    await act(async () => { await result.current.runCompetitorSearch(); });

    expect(result.current.error).toBe('');
    expect(result.current.message).toMatch(/non configurata/);
  });

  it('se la ricerca va in errore lo dice e non lascia il caricamento acceso', async () => {
    searchAgencyProjectCompetitors.mockRejectedValue(new Error('Servizio non raggiungibile'));
    const { result } = await montaHook();

    await act(async () => { await result.current.runCompetitorSearch(); });

    expect(result.current.error).toBe('Servizio non raggiungibile');
    expect(result.current.searching).toBe(false);
  });
});

describe('salvataggio', () => {
  it('con un URL non valido blocca prima di chiamare il server', async () => {
    getAgencyProjectSources.mockResolvedValue(payloadFonti({
      urls: [{ id: 'url_1', label: 'Sito', type: 'website', url: 'cliente-senza-protocollo', status: 'active' }],
    }));
    const { result } = await montaHook();

    await act(async () => { await result.current.handleSave(); });

    expect(saveAgencyProjectSources).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/Controlla questi URL prima di salvare: Sito/);
    expect(result.current.saving).toBe(false);
  });

  it('salva ripulendo gli indirizzi e fondendo i competitor della casella rapida', async () => {
    saveAgencyProjectSources.mockImplementation(async (_id, payload) => ({ ...payload, persisted: true }));
    const { result } = await montaHook();

    act(() => result.current.setCompetitorUrlsText('https://rivale.it'));
    await act(async () => { await result.current.handleSave(); });

    const inviato = saveAgencyProjectSources.mock.calls[0][1];
    expect(inviato.competitorUrls).toEqual(['https://rivale.it']);
    expect(inviato.competitors[0]).toMatchObject({ url: 'https://rivale.it', source: 'manual' });
    expect(inviato.primaryWebsiteUrl).toBe('https://cliente.it');
    expect(result.current.message).toBe('Fonti progetto aggiornate e ricaricabili.');
  });

  it('le righe senza indirizzo non vengono salvate', async () => {
    getAgencyProjectSources.mockResolvedValue(payloadFonti({
      urls: [
        { id: 'url_1', label: 'Sito', type: 'website', url: 'https://cliente.it', status: 'active' },
        { id: 'url_2', label: '', type: 'other', url: '  ', status: 'active' },
      ],
    }));
    saveAgencyProjectSources.mockImplementation(async (_id, payload) => ({ ...payload, persisted: true }));
    const { result } = await montaHook();

    await act(async () => { await result.current.handleSave(); });

    expect(saveAgencyProjectSources.mock.calls[0][1].urls).toHaveLength(1);
  });

  it('se il salvataggio fallisce lo dice e sblocca il pulsante', async () => {
    saveAgencyProjectSources.mockRejectedValue(new Error('Rete non raggiungibile'));
    const { result } = await montaHook();

    await act(async () => { await result.current.handleSave(); });

    expect(result.current.error).toBe('Rete non raggiungibile');
    expect(result.current.saving).toBe(false);
  });
});
