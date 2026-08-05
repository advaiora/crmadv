import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SettingsProviderPanel from './SettingsProviderPanel';
import SettingsAiLimitsPanel from './SettingsAiLimitsPanel';
import SettingsCompetitorSearchPanel from './SettingsCompetitorSearchPanel';
import SettingsAiProviderCard from './SettingsAiProviderCard';
import SettingsProjectTypesCard from './SettingsProjectTypesCard';
import SettingsScopeSourcesCard from './SettingsScopeSourcesCard';
import SettingsTeamRolesCard from './SettingsTeamRolesCard';
import SettingsModulesCard from './SettingsModulesCard';

const form = (overrides = {}) => ({
  aiEnabled: true,
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  aiTimeoutMs: 45000,
  aiInputMaxChars: 12000,
  aiStringMaxChars: 1200,
  aiFileTextMaxChars: 1800,
  aiMaxOutputTokens: 1800,
  aiDefaultMode: 'quick',
  aiDebugEnabled: false,
  aiFunctionModelsText: '{}',
  openAiApiKey: '',
  anthropicApiKey: '',
  competitorSearchEnabled: false,
  competitorSearchProvider: 'none',
  ...overrides,
});

const modelli = [
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4', provider: 'anthropic', hint: 'testi lunghi' },
];

const provider = (overrides = {}) => ({
  form: form(),
  canManage: true,
  storageReady: true,
  saving: false,
  activeModels: modelli,
  activeProviders: ['openai', 'anthropic'],
  selectedModelOption: modelli[0],
  aiApiKeyConfigured: true,
  anthropicApiKeyConfigured: true,
  onFieldChange: vi.fn(),
  onSelectModel: vi.fn(),
  clearKeysProvider: '',
  onClearKeysProviderChange: vi.fn(),
  onClearKeys: vi.fn(),
  ...overrides,
});

describe('SettingsProviderPanel', () => {
  it('dice quali chiavi sono presenti e quali no', () => {
    render(<SettingsProviderPanel {...provider({ anthropicApiKeyConfigured: false })} />);

    expect(screen.getByText('API key OpenAI').closest('label')).toHaveTextContent('presente');
    expect(screen.getByText('API key Anthropic (Claude)').closest('label')).toHaveTextContent('assente');
  });

  it('senza provider attivi il menu modelli e bloccato e lo spiega', () => {
    render(<SettingsProviderPanel {...provider({ activeModels: [], activeProviders: [] })} />);

    expect(screen.getByLabelText('Modello preferito')).toBeDisabled();
    expect(screen.getByText(/elenca solo i modelli dei provider con API key/)).toBeInTheDocument();
  });

  it('con provider attivi mostra il provider del modello scelto e il suo suggerimento', () => {
    render(<SettingsProviderPanel {...provider({ selectedModelOption: modelli[1] })} />);

    expect(screen.getByText(/Provider scelto dal modello: Anthropic \(Claude\) \(testi lunghi\)/)).toBeInTheDocument();
  });

  it('scegliere un modello passa dalla funzione dedicata, non da un campo qualsiasi', () => {
    const props = provider();
    render(<SettingsProviderPanel {...props} />);

    fireEvent.change(screen.getByLabelText('Modello preferito'), { target: { value: 'claude-sonnet-4' } });

    expect(props.onSelectModel).toHaveBeenCalledWith('claude-sonnet-4');
    expect(props.onFieldChange).not.toHaveBeenCalled();
  });

  it('in sola lettura blocca interruttore, chiavi e cancellazione', () => {
    render(<SettingsProviderPanel {...provider({ canManage: false })} />);

    expect(screen.getByLabelText('Abilita generazioni AI')).toBeDisabled();
    expect(screen.getByLabelText(/API key OpenAI/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Cancella permanentemente/ })).toBeDisabled();
  });

  // Senza nessuna chiave salvata non c'e' niente da cancellare.
  it('senza chiavi salvate il bottone di cancellazione e spento', () => {
    render(<SettingsProviderPanel {...provider({ aiApiKeyConfigured: false, anthropicApiKeyConfigured: false })} />);

    expect(screen.getByRole('button', { name: /Cancella permanentemente/ })).toBeDisabled();
  });

  it('mentre salva il bottone di cancellazione e spento', () => {
    render(<SettingsProviderPanel {...provider({ saving: true })} />);

    expect(screen.getByRole('button', { name: /Cancella permanentemente/ })).toBeDisabled();
  });

  it('inoltra la scelta di cosa cancellare e il comando', () => {
    const props = provider();
    render(<SettingsProviderPanel {...props} />);

    fireEvent.change(screen.getByLabelText('Cosa cancellare'), { target: { value: 'anthropic' } });
    screen.getByRole('button', { name: /Cancella permanentemente/ }).click();

    expect(props.onClearKeysProviderChange).toHaveBeenCalledWith('anthropic');
    expect(props.onClearKeys).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsAiLimitsPanel', () => {
  it('mostra i limiti correnti', () => {
    render(<SettingsAiLimitsPanel form={form()} canManage storageReady onFieldChange={vi.fn()} />);

    expect(screen.getByLabelText('Timeout chiamata')).toHaveValue(45000);
    expect(screen.getByLabelText('Max output token')).toHaveValue(1800);
    expect(screen.getByLabelText('Modalita default')).toHaveValue('quick');
  });

  it('inoltra la modifica di un limite col nome del campo giusto', () => {
    const onFieldChange = vi.fn();
    render(<SettingsAiLimitsPanel form={form()} canManage storageReady onFieldChange={onFieldChange} />);

    fireEvent.change(screen.getByLabelText('Max input'), { target: { value: '20000' } });

    expect(onFieldChange).toHaveBeenCalledWith('aiInputMaxChars', '20000');
  });

  it('senza storage pronto blocca anche i modelli per funzione', () => {
    render(<SettingsAiLimitsPanel form={form()} canManage storageReady={false} onFieldChange={vi.fn()} />);

    expect(screen.getByLabelText('Modelli per funzione')).toBeDisabled();
  });
});

describe('SettingsCompetitorSearchPanel', () => {
  it('elenca i provider di ricerca disponibili', () => {
    render(<SettingsCompetitorSearchPanel form={form()} canManage storageReady onFieldChange={vi.fn()} />);

    const menu = screen.getByLabelText('Provider ricerca');
    expect(menu).toHaveValue('none');
    expect(screen.getByRole('option', { name: 'OpenAI web search' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'SerpAPI' })).toBeInTheDocument();
  });

  it('inoltra interruttore e provider', () => {
    const onFieldChange = vi.fn();
    render(<SettingsCompetitorSearchPanel form={form()} canManage storageReady onFieldChange={onFieldChange} />);

    screen.getByLabelText('Abilita ricerca competitor online').click();
    fireEvent.change(screen.getByLabelText('Provider ricerca'), { target: { value: 'serpapi' } });

    expect(onFieldChange).toHaveBeenCalledWith('competitorSearchEnabled', true);
    expect(onFieldChange).toHaveBeenCalledWith('competitorSearchProvider', 'serpapi');
  });
});

const cardGenitrice = (overrides = {}) => ({
  aiStatus: { configured: true, provider: 'openai', model: 'gpt-4o-mini' },
  competitorSearchSettings: { status: 'not_configured', provider: 'none', message: 'Nessun provider.' },
  form: form(),
  canManage: true,
  storageReady: true,
  saveState: { status: 'idle', message: '' },
  activeModels: modelli,
  activeProviders: ['openai', 'anthropic'],
  selectedModelOption: modelli[0],
  aiApiKeyConfigured: true,
  anthropicApiKeyConfigured: false,
  onFieldChange: vi.fn(),
  onSelectModel: vi.fn(),
  onSubmit: vi.fn((event) => event.preventDefault()),
  onRefresh: vi.fn(),
  clearKeysProvider: '',
  onClearKeysProviderChange: vi.fn(),
  onClearKeys: vi.fn(),
  ...overrides,
});

describe('SettingsAiProviderCard', () => {
  // "Ricerca competitor" compare due volte: come colonna del riepilogo e come
  // titolo del riquadro. Qui interessa il titolo, quindi si cerca l'intestazione.
  it('monta i tre riquadri dentro un solo form', () => {
    render(<SettingsAiProviderCard {...cardGenitrice()} />);

    expect(screen.getByRole('heading', { name: 'Provider AI' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Limiti AI, cache e costi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ricerca competitor' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Salva impostazioni' })).toHaveLength(1);
  });

  it('riassume stato AI, chiavi e ricerca competitor', () => {
    render(<SettingsAiProviderCard {...cardGenitrice()} />);

    expect(screen.getByText('OpenAI: presente')).toBeInTheDocument();
    expect(screen.getByText('Anthropic: assente')).toBeInTheDocument();
    expect(screen.getByText('Nessun provider.')).toBeInTheDocument();
  });

  // Il primo badge della card e' quello di stato in cima. Si cerca per posizione
  // perche' "Configurata" compare anche nella riga di riepilogo dell'AI.
  it('il badge in cima segue lo stato della ricerca competitor', () => {
    const { container, rerender } = render(<SettingsAiProviderCard {...cardGenitrice()} />);
    expect(container.querySelector('.badge')).toHaveTextContent('Non configurata');

    rerender(<SettingsAiProviderCard {...cardGenitrice({
      competitorSearchSettings: { status: 'configured', provider: 'openai_web_search', message: 'Attiva.' },
    })} />);
    expect(container.querySelector('.badge')).toHaveTextContent('Configurata');
  });

  it('in sola lettura avvisa e blocca il salvataggio', () => {
    render(<SettingsAiProviderCard {...cardGenitrice({ canManage: false })} />);

    expect(screen.getByText(/Accesso in sola lettura/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva impostazioni' })).toBeDisabled();
  });

  it('senza storage pronto avvisa della migration mancante', () => {
    render(<SettingsAiProviderCard {...cardGenitrice({ storageReady: false })} />);

    expect(screen.getByText(/Applica la migration Agency runtime settings/)).toBeInTheDocument();
  });

  // Un errore e' un avviso da leggere subito, un esito riuscito no. Si guarda
  // il ruolo del singolo avviso: nella card ce n'e' piu' d'uno con ruolo
  // "alert" (le Alert di react-bootstrap ce l'hanno di default).
  it('un errore di salvataggio e un avviso, un successo e uno stato', () => {
    const { rerender } = render(<SettingsAiProviderCard {...cardGenitrice({
      saveState: { status: 'error', message: 'Chiave non valida' },
    })} />);
    expect(screen.getByText('Chiave non valida')).toHaveAttribute('role', 'alert');

    rerender(<SettingsAiProviderCard {...cardGenitrice({
      saveState: { status: 'success', message: 'Impostazioni salvate.' },
    })} />);
    expect(screen.getByText('Impostazioni salvate.')).toHaveAttribute('role', 'status');
  });

  it('mentre salva lo dice sul bottone', () => {
    render(<SettingsAiProviderCard {...cardGenitrice({ saveState: { status: 'saving', message: 'In corso...' } })} />);

    expect(screen.getByRole('button', { name: 'Salvataggio...' })).toBeDisabled();
  });

  it('inoltra invio del form e aggiornamento dello stato', () => {
    const props = cardGenitrice();
    render(<SettingsAiProviderCard {...props} />);

    screen.getByRole('button', { name: 'Aggiorna stato' }).click();
    fireEvent.submit(screen.getByRole('button', { name: 'Salva impostazioni' }).closest('form'));

    expect(props.onRefresh).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('cataloghi di sola lettura', () => {
  it('i tipi di progetto elencano chiave e descrizione', () => {
    render(<SettingsProjectTypesCard />);

    expect(screen.getByText('Project types disponibili')).toBeInTheDocument();
    expect(screen.getAllByText(/\|/).length).toBeGreaterThan(0);
  });

  it('gli scope mostrano anche lo stato dei dettagli tecnici', () => {
    const { rerender } = render(<SettingsScopeSourcesCard isDev />);
    expect(screen.getByText(/visibili in sviluppo/)).toBeInTheDocument();

    rerender(<SettingsScopeSourcesCard isDev={false} />);
    expect(screen.getByText(/nascosti in produzione/)).toBeInTheDocument();
  });

  it('i ruoli team elencano tutti e cinque i ruoli', () => {
    render(<SettingsTeamRolesCard />);

    expect(screen.getByText('Web')).toBeInTheDocument();
    expect(screen.getByText('Marketing Strategy PM')).toBeInTheDocument();
    expect(screen.getByText('Ads Specialist')).toBeInTheDocument();
    expect(screen.getByText('Graphic ADV Social')).toBeInTheDocument();
    expect(screen.getByText('Graphic Offline')).toBeInTheDocument();
  });

  it('i moduli elencano le voci attive e la nota sui permessi', () => {
    render(<SettingsModulesCard />);

    expect(screen.getByText('discovery')).toBeInTheDocument();
    expect(screen.getByText('sources/assets')).toBeInTheDocument();
    expect(screen.getByText(/gestibili dal backend CRM solo da Superadmin/)).toBeInTheDocument();
  });
});
