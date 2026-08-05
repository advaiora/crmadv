import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  getAgencyAiStatus,
  getAgencyCompetitorSearchSettings,
  getAgencyRuntimeSettings,
  saveAgencyRuntimeSettings,
} from '../../../../modules/agency-os/data/agencyDataAdapter';
import { useAgencySettings } from './useAgencySettings';

// Si finge solo il confine col server. `buildRuntimeForm` gira davvero: e' gia'
// coperto a parte, ma qui serve vero per vedere l'effetto sulla bozza del form.
vi.mock('../../../../modules/agency-os/data/agencyDataAdapter', () => ({
  getAgencyAiStatus: vi.fn(),
  getAgencyCompetitorSearchSettings: vi.fn(),
  getAgencyRuntimeSettings: vi.fn(),
  saveAgencyRuntimeSettings: vi.fn(),
}));

const impostazioni = (overrides = {}) => ({
  canManage: true,
  storageReady: true,
  ai: {
    enabled: true,
    provider: 'openai',
    model: 'gpt-4o-mini',
    openAiApiKeyConfigured: true,
    anthropicApiKeyConfigured: false,
    functionModels: {},
  },
  competitorSearch: { enabled: false, provider: 'none' },
  availableModels: [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
    { id: 'claude-sonnet-4', label: 'Claude Sonnet 4', provider: 'anthropic', hint: 'testi lunghi' },
  ],
  ...overrides,
});

const montaHook = async () => {
  const risultato = renderHook(() => useAgencySettings());
  await waitFor(() => expect(risultato.result.current.runtimeSettings).not.toBeNull());
  return risultato;
};

// `clearAllMocks` azzera le chiamate ma NON le implementazioni: senza
// reimpostare anche `saveAgencyRuntimeSettings`, un `mockRejectedValue` messo
// da un test sopravvive a quelli dopo, che falliscono con un errore ereditato.
beforeEach(() => {
  vi.clearAllMocks();
  getAgencyCompetitorSearchSettings.mockResolvedValue({ status: 'not_configured', provider: 'none', message: 'Nessun provider.' });
  getAgencyAiStatus.mockResolvedValue({ configured: true, provider: 'openai', model: 'gpt-4o-mini' });
  getAgencyRuntimeSettings.mockResolvedValue(impostazioni());
  saveAgencyRuntimeSettings.mockResolvedValue(impostazioni());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('caricamento', () => {
  it('carica le tre fonti e riempie la bozza del form', async () => {
    const { result } = await montaHook();

    expect(getAgencyCompetitorSearchSettings).toHaveBeenCalledTimes(1);
    expect(getAgencyAiStatus).toHaveBeenCalledTimes(1);
    expect(getAgencyRuntimeSettings).toHaveBeenCalledTimes(1);
    expect(result.current.runtimeForm.aiModel).toBe('gpt-4o-mini');
    expect(result.current.aiStatus.configured).toBe(true);
  });

  // Le tre chiamate partono con Promise.allSettled: se una fallisce, le altre
  // due devono comunque arrivare a destinazione.
  it('se la ricerca competitor fallisce carica lo stesso le altre due', async () => {
    getAgencyCompetitorSearchSettings.mockRejectedValue(new Error('rete giu'));

    const { result } = await montaHook();

    expect(result.current.competitorSearchSettings.message).toMatch(/Stato ricerca non disponibile/);
    expect(result.current.aiStatus.configured).toBe(true);
    expect(result.current.runtimeForm.aiModel).toBe('gpt-4o-mini');
  });
});

describe('derivati', () => {
  it('il menu modelli elenca solo i provider con una chiave', async () => {
    const { result } = await montaHook();

    expect(result.current.activeProviders).toEqual(['openai']);
    expect(result.current.activeModels).toHaveLength(1);
    expect(result.current.activeModels[0].id).toBe('gpt-4o-mini');
    expect(result.current.selectedModelOption.label).toBe('GPT-4o mini');
  });

  it('con due chiavi presenti compaiono entrambi i provider', async () => {
    getAgencyRuntimeSettings.mockResolvedValue(impostazioni({
      ai: { ...impostazioni().ai, anthropicApiKeyConfigured: true },
    }));

    const { result } = await montaHook();

    expect(result.current.activeProviders).toEqual(['openai', 'anthropic']);
    expect(result.current.activeModels).toHaveLength(2);
  });

  it('senza permesso di gestione lo dichiara', async () => {
    getAgencyRuntimeSettings.mockResolvedValue(impostazioni({ canManage: false }));

    const { result } = await montaHook();

    expect(result.current.canManage).toBe(false);
  });

  it('storageReady e vero se il server non dice esplicitamente di no', async () => {
    getAgencyRuntimeSettings.mockResolvedValue(impostazioni({ storageReady: undefined }));

    const { result } = await montaHook();

    expect(result.current.storageReady).toBe(true);
  });
});

describe('scelta del modello', () => {
  // Un gesto solo cambia due campi: il modello e il suo provider.
  it('scegliere un modello fissa anche il provider', async () => {
    const { result } = await montaHook();

    act(() => result.current.selectAiModel('claude-sonnet-4'));

    expect(result.current.runtimeForm.aiModel).toBe('claude-sonnet-4');
    expect(result.current.runtimeForm.aiProvider).toBe('anthropic');
  });

  it('un modello sconosciuto non cambia il provider gia scelto', async () => {
    const { result } = await montaHook();

    act(() => result.current.selectAiModel('modello-inventato'));

    expect(result.current.runtimeForm.aiModel).toBe('modello-inventato');
    expect(result.current.runtimeForm.aiProvider).toBe('openai');
  });
});

describe('salvataggio', () => {
  const evento = () => ({ preventDefault: vi.fn() });

  it('senza permesso non chiama il server', async () => {
    getAgencyRuntimeSettings.mockResolvedValue(impostazioni({ canManage: false }));
    const { result } = await montaHook();

    await act(async () => { await result.current.handleSaveRuntimeSettings(evento()); });

    expect(saveAgencyRuntimeSettings).not.toHaveBeenCalled();
    expect(result.current.saveState.status).toBe('error');
    expect(result.current.saveState.message).toMatch(/Superadmin/);
  });

  // Il JSON dei modelli per funzione e' scritto a mano: se non e' valido il
  // salvataggio si ferma PRIMA di toccare il server.
  it('con un JSON non valido si ferma e non chiama il server', async () => {
    const { result } = await montaHook();
    act(() => result.current.updateFormField('aiFunctionModelsText', '{ non e json'));

    await act(async () => { await result.current.handleSaveRuntimeSettings(evento()); });

    expect(saveAgencyRuntimeSettings).not.toHaveBeenCalled();
    expect(result.current.saveState.status).toBe('error');
    expect(result.current.saveState.message).toMatch(/JSON valido/);
  });

  it('un JSON vuoto e ammesso e manda un oggetto vuoto', async () => {
    saveAgencyRuntimeSettings.mockResolvedValue(impostazioni());
    const { result } = await montaHook();
    act(() => result.current.updateFormField('aiFunctionModelsText', '   '));

    await act(async () => { await result.current.handleSaveRuntimeSettings(evento()); });

    expect(saveAgencyRuntimeSettings).toHaveBeenCalledWith(
      expect.objectContaining({ ai: expect.objectContaining({ functionModels: {} }) }),
    );
  });

  // Campo write-only: la chiave finisce nel payload solo se e' stata digitata.
  it('non manda le chiavi API se le caselle sono vuote', async () => {
    saveAgencyRuntimeSettings.mockResolvedValue(impostazioni());
    const { result } = await montaHook();

    await act(async () => { await result.current.handleSaveRuntimeSettings(evento()); });

    const payload = saveAgencyRuntimeSettings.mock.calls[0][0];
    expect(payload.ai).not.toHaveProperty('openAiApiKey');
    expect(payload.ai).not.toHaveProperty('anthropicApiKey');
  });

  it('manda la chiave digitata, ripulita dagli spazi', async () => {
    saveAgencyRuntimeSettings.mockResolvedValue(impostazioni());
    const { result } = await montaHook();
    act(() => result.current.updateFormField('anthropicApiKey', '  sk-ant-nuova  '));

    await act(async () => { await result.current.handleSaveRuntimeSettings(evento()); });

    const payload = saveAgencyRuntimeSettings.mock.calls[0][0];
    expect(payload.ai.anthropicApiKey).toBe('sk-ant-nuova');
    expect(payload.ai).not.toHaveProperty('openAiApiKey');
  });

  it('i numeri vuoti ripiegano sui valori predefiniti', async () => {
    saveAgencyRuntimeSettings.mockResolvedValue(impostazioni());
    const { result } = await montaHook();
    act(() => result.current.updateFormField('aiTimeoutMs', ''));

    await act(async () => { await result.current.handleSaveRuntimeSettings(evento()); });

    expect(saveAgencyRuntimeSettings.mock.calls[0][0].ai.timeoutMs).toBe(45000);
  });

  it('dopo il salvataggio risincronizza impostazioni e form e ricarica lo stato', async () => {
    const aggiornate = impostazioni({
      ai: { ...impostazioni().ai, model: 'claude-sonnet-4', provider: 'anthropic' },
    });
    saveAgencyRuntimeSettings.mockResolvedValue(aggiornate);
    const { result } = await montaHook();
    getAgencyRuntimeSettings.mockResolvedValue(aggiornate);

    await act(async () => { await result.current.handleSaveRuntimeSettings(evento()); });

    expect(result.current.runtimeSettings.ai.model).toBe('claude-sonnet-4');
    expect(result.current.runtimeForm.aiModel).toBe('claude-sonnet-4');
    expect(result.current.saveState.status).toBe('success');
    expect(getAgencyRuntimeSettings).toHaveBeenCalledTimes(2);
  });

  // Il salvataggio scrive lo stato con la risposta del server e SUBITO DOPO
  // richiama refreshSettings: e' quella rilettura ad avere l'ultima parola.
  // Toglierla lascerebbe la pagina su valori che il server potrebbe aver
  // normalizzato diversamente.
  it('la rilettura dopo il salvataggio ha l ultima parola sui valori', async () => {
    saveAgencyRuntimeSettings.mockResolvedValue(impostazioni({
      ai: { ...impostazioni().ai, model: 'claude-sonnet-4' },
    }));
    const { result } = await montaHook();

    await act(async () => { await result.current.handleSaveRuntimeSettings(evento()); });

    expect(result.current.runtimeSettings.ai.model).toBe('gpt-4o-mini');
    expect(result.current.runtimeForm.aiModel).toBe('gpt-4o-mini');
  });

  it('se il server rifiuta riporta il suo messaggio', async () => {
    saveAgencyRuntimeSettings.mockRejectedValue(new Error('Chiave non valida'));
    const { result } = await montaHook();

    await act(async () => { await result.current.handleSaveRuntimeSettings(evento()); });

    expect(result.current.saveState.status).toBe('error');
    expect(result.current.saveState.message).toBe('Chiave non valida');
  });
});

describe('cancellazione delle chiavi', () => {
  it('chiede conferma e se si annulla non chiama il server', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    const { result } = await montaHook();

    await act(async () => { await result.current.handleClearKeys(); });

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(saveAgencyRuntimeSettings).not.toHaveBeenCalled();
  });

  it('senza selezione cancella tutte e due le chiavi', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    saveAgencyRuntimeSettings.mockResolvedValue(impostazioni());
    const { result } = await montaHook();

    await act(async () => { await result.current.handleClearKeys(); });

    expect(saveAgencyRuntimeSettings).toHaveBeenCalledWith({
      ai: { clearOpenAiApiKey: true, clearAnthropicApiKey: true },
    });
    expect(result.current.saveState.message).toMatch(/tutte le API key/);
  });

  it('con un provider scelto cancella solo quella chiave', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    saveAgencyRuntimeSettings.mockResolvedValue(impostazioni());
    const { result } = await montaHook();
    act(() => result.current.setClearKeysProvider('anthropic'));

    await act(async () => { await result.current.handleClearKeys(); });

    expect(saveAgencyRuntimeSettings).toHaveBeenCalledWith({
      ai: { clearOpenAiApiKey: false, clearAnthropicApiKey: true },
    });
    expect(result.current.saveState.message).toMatch(/la chiave Anthropic/);
  });

  it('senza permesso non chiede nemmeno conferma', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    getAgencyRuntimeSettings.mockResolvedValue(impostazioni({ canManage: false }));
    const { result } = await montaHook();

    await act(async () => { await result.current.handleClearKeys(); });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(saveAgencyRuntimeSettings).not.toHaveBeenCalled();
    expect(result.current.saveState.status).toBe('error');
  });
});

describe('confini della facciata', () => {
  // I setter grezzi restano dentro: se ricomparissero, la pagina potrebbe
  // cambiare impostazioni e form separatamente e disallinearli.
  it('non espone i tre setter grezzi', async () => {
    const { result } = await montaHook();

    expect(result.current.setRuntimeSettings).toBeUndefined();
    expect(result.current.setRuntimeForm).toBeUndefined();
    expect(result.current.setSaveState).toBeUndefined();
  });

  it('espone invece quello che serve ai riquadri', async () => {
    const { result } = await montaHook();

    expect(typeof result.current.updateFormField).toBe('function');
    expect(typeof result.current.selectAiModel).toBe('function');
    expect(typeof result.current.setClearKeysProvider).toBe('function');
    expect(typeof result.current.refreshSettings).toBe('function');
  });
});
