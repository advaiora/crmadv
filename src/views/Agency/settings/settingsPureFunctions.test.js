import { describe, expect, it } from 'vitest';
import { buildRuntimeForm, getProviderSetupMessage } from './settingsFormHelpers';

describe('buildRuntimeForm', () => {
  it('senza impostazioni dal server riempie tutto con i valori predefiniti', () => {
    const form = buildRuntimeForm(null);

    expect(form.aiEnabled).toBe(false);
    expect(form.aiProvider).toBe('none');
    expect(form.aiModel).toBe('gpt-4o-mini');
    expect(form.aiTimeoutMs).toBe(45000);
    expect(form.aiInputMaxChars).toBe(12000);
    expect(form.aiStringMaxChars).toBe(1200);
    expect(form.aiFileTextMaxChars).toBe(1800);
    expect(form.aiMaxOutputTokens).toBe(1800);
    expect(form.aiDefaultMode).toBe('quick');
    expect(form.aiDebugEnabled).toBe(false);
    expect(form.competitorSearchEnabled).toBe(false);
    expect(form.competitorSearchProvider).toBe('none');
  });

  it('ricopia i valori del server quando ci sono', () => {
    const form = buildRuntimeForm({
      ai: {
        enabled: true,
        provider: 'anthropic',
        model: 'claude-sonnet-4',
        timeoutMs: 60000,
        inputMaxChars: 20000,
        stringMaxChars: 2000,
        fileTextMaxChars: 3000,
        maxOutputTokens: 4000,
        defaultMode: 'deep',
        debugEnabled: true,
      },
      competitorSearch: { enabled: true, provider: 'serpapi' },
    });

    expect(form.aiEnabled).toBe(true);
    expect(form.aiProvider).toBe('anthropic');
    expect(form.aiModel).toBe('claude-sonnet-4');
    expect(form.aiTimeoutMs).toBe(60000);
    expect(form.aiInputMaxChars).toBe(20000);
    expect(form.aiStringMaxChars).toBe(2000);
    expect(form.aiFileTextMaxChars).toBe(3000);
    expect(form.aiMaxOutputTokens).toBe(4000);
    expect(form.aiDefaultMode).toBe('deep');
    expect(form.aiDebugEnabled).toBe(true);
    expect(form.competitorSearchEnabled).toBe(true);
    expect(form.competitorSearchProvider).toBe('serpapi');
  });

  it('serializza i modelli per funzione in JSON leggibile', () => {
    const form = buildRuntimeForm({
      ai: { functionModels: { 'discovery.generateBrief': 'gpt-4o-mini' } },
    });

    expect(form.aiFunctionModelsText).toBe('{\n  "discovery.generateBrief": "gpt-4o-mini"\n}');
  });

  it('senza modelli per funzione scrive un oggetto vuoto, non "undefined"', () => {
    expect(buildRuntimeForm(null).aiFunctionModelsText).toBe('{}');
    expect(buildRuntimeForm({ ai: {} }).aiFunctionModelsText).toBe('{}');
  });

  // Il campo chiave e' write-only: "vuoto = non cambiare". Se il form ripartisse
  // da un valore letto dal server, un salvataggio qualsiasi lo rimanderebbe
  // indietro come se fosse una chiave nuova.
  it('lascia sempre vuote le due chiavi API, anche se il server manda qualcosa', () => {
    const form = buildRuntimeForm({
      ai: { openAiApiKey: 'sk-vecchia', anthropicApiKey: 'sk-ant-vecchia' },
    });

    expect(form.openAiApiKey).toBe('');
    expect(form.anthropicApiKey).toBe('');
  });

  it('tratta lo zero come valore assente e ripiega sul predefinito', () => {
    const form = buildRuntimeForm({ ai: { timeoutMs: 0, maxOutputTokens: 0 } });

    expect(form.aiTimeoutMs).toBe(45000);
    expect(form.aiMaxOutputTokens).toBe(1800);
  });
});

describe('getProviderSetupMessage', () => {
  const configuredAi = { configured: true };
  const notConfiguredAi = { configured: false };

  it('con AI e ricerca competitor configurate lo dice di entrambe', () => {
    const message = getProviderSetupMessage(configuredAi, { status: 'configured' });

    expect(message).toContain('AI generativa e ricerca competitor online sono configurate');
  });

  it('con la sola AI configurata avverte che la ricerca competitor e separata', () => {
    const message = getProviderSetupMessage(configuredAi, { status: 'not_configured' });

    expect(message).toContain('AI generativa configurata lato server');
    expect(message).toContain('separata');
  });

  it('con la sola ricerca competitor configurata avverte che le generazioni restano bozze', () => {
    const message = getProviderSetupMessage(notConfiguredAi, { status: 'configured' });

    expect(message).toContain('Ricerca competitor online configurata');
    expect(message).toContain('bozze base dichiarate');
  });

  it('senza niente configurato spiega cosa si puo fare lo stesso', () => {
    const message = getProviderSetupMessage(notConfiguredAi, { status: 'not_configured' });

    expect(message).toContain('non sono configurate');
    expect(message).toContain('competitor manuali');
  });

  // "configured_not_active" = provider impostato ma interruttore spento: conta
  // come configurato, altrimenti il messaggio direbbe di aggiungere una cosa
  // che c'e' gia'.
  it('considera configurata anche la ricerca impostata ma non attiva', () => {
    const message = getProviderSetupMessage(notConfiguredAi, { status: 'configured_not_active' });

    expect(message).toContain('Ricerca competitor online configurata');
  });

  it('uno stato di errore del provider non conta come configurato', () => {
    const message = getProviderSetupMessage(notConfiguredAi, { status: 'configured_error' });

    expect(message).toContain('non sono configurate');
  });

  it('senza argomenti non esplode e ripiega sul caso "niente configurato"', () => {
    expect(getProviderSetupMessage(undefined, undefined)).toContain('non sono configurate');
  });
});
