import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useAgencySettings } from './settings/hooks/useAgencySettings';
import AgencySettingsPage from './AgencySettingsPage';

// Come le pagine sorelle del blocco Agency: la pagina assembla l'hook radice e
// i riquadri, e qui si verifica proprio l'assemblaggio. Si finge l'hook (gia'
// coperto da useAgencySettings.test.js) e il guscio di pagina.
vi.mock('./settings/hooks/useAgencySettings', () => ({
  useAgencySettings: vi.fn(),
}));

vi.mock('./AgencyPageShell', () => ({
  default: ({ title, subtitle, children }) => (
    <div data-testid="guscio-pagina">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

// I due pannelli dei consumi caricano dati per conto loro: vanno finti o
// proverebbero a chiamare il server.
vi.mock('./AgencyAiUsagePanel', () => ({
  default: () => <div data-testid="pannello-consumi" />,
}));

vi.mock('./AgencyAiBudgetPanel', () => ({
  default: () => <div data-testid="pannello-budget" />,
}));

const modelli = [
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4', provider: 'anthropic' },
];

const statoHook = (overrides = {}) => ({
  competitorSearchSettings: { status: 'not_configured', provider: 'none', message: 'Nessun provider.' },
  aiStatus: { configured: true, provider: 'openai', model: 'gpt-4o-mini' },
  runtimeSettings: {},
  runtimeForm: {
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
  },
  saveState: { status: 'idle', message: '' },
  canManage: true,
  storageReady: true,
  aiApiKeyConfigured: true,
  anthropicApiKeyConfigured: false,
  activeProviders: ['openai'],
  activeModels: [modelli[0]],
  selectedModelOption: modelli[0],
  updateFormField: vi.fn(),
  selectAiModel: vi.fn(),
  refreshSettings: vi.fn(),
  handleSaveRuntimeSettings: vi.fn((event) => event.preventDefault()),
  clearKeysProvider: '',
  setClearKeysProvider: vi.fn(),
  handleClearKeys: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  useAgencySettings.mockReturnValue(statoHook());
});

describe('AgencySettingsPage', () => {
  it('mostra titolo, card principale e i quattro cataloghi', () => {
    render(<AgencySettingsPage />);

    expect(screen.getByRole('heading', { name: 'Impostazioni AI', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI e Ricerca Competitor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Project types disponibili' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scope acquistabile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ruoli team' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Moduli Agency attivi' })).toBeInTheDocument();
  });

  // I due pannelli dei consumi sono per chi puo' gestire: montarli sempre
  // farebbe partire chiamate al server anche in sola lettura.
  it('i pannelli consumi e budget compaiono solo a chi puo gestire', () => {
    render(<AgencySettingsPage />);
    expect(screen.getByTestId('pannello-consumi')).toBeInTheDocument();
    expect(screen.getByTestId('pannello-budget')).toBeInTheDocument();
  });

  it('in sola lettura i due pannelli spariscono ma i cataloghi restano', () => {
    useAgencySettings.mockReturnValue(statoHook({ canManage: false }));
    render(<AgencySettingsPage />);

    expect(screen.queryByTestId('pannello-consumi')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pannello-budget')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ruoli team' })).toBeInTheDocument();
    expect(screen.getByText(/Accesso in sola lettura/)).toBeInTheDocument();
  });

  // I collegamenti che seguono fallirebbero in silenzio se un nome cambiasse:
  // la pagina si disegnerebbe lo stesso, solo senza fare piu' niente.
  it('la bozza del form arriva ai riquadri', () => {
    useAgencySettings.mockReturnValue(statoHook({
      runtimeForm: { ...statoHook().runtimeForm, aiTimeoutMs: 60000, aiFunctionModelsText: '{"a":"b"}' },
    }));
    render(<AgencySettingsPage />);

    expect(screen.getByLabelText('Timeout chiamata')).toHaveValue(60000);
    expect(screen.getByLabelText('Modelli per funzione')).toHaveValue('{"a":"b"}');
  });

  it('modificare un campo passa da updateFormField', () => {
    const stato = statoHook();
    useAgencySettings.mockReturnValue(stato);
    render(<AgencySettingsPage />);

    fireEvent.change(screen.getByLabelText('Max output token'), { target: { value: '2400' } });

    expect(stato.updateFormField).toHaveBeenCalledWith('aiMaxOutputTokens', '2400');
  });

  it('scegliere il modello passa da selectAiModel', () => {
    const stato = statoHook({ activeModels: modelli, activeProviders: ['openai', 'anthropic'] });
    useAgencySettings.mockReturnValue(stato);
    render(<AgencySettingsPage />);

    fireEvent.change(screen.getByLabelText('Modello preferito'), { target: { value: 'claude-sonnet-4' } });

    expect(stato.selectAiModel).toHaveBeenCalledWith('claude-sonnet-4');
  });

  it('salvataggio e aggiornamento stato sono collegati alle rispettive funzioni', () => {
    const stato = statoHook();
    useAgencySettings.mockReturnValue(stato);
    render(<AgencySettingsPage />);

    fireEvent.submit(screen.getByRole('button', { name: 'Salva impostazioni' }).closest('form'));
    screen.getByRole('button', { name: 'Aggiorna stato' }).click();

    expect(stato.handleSaveRuntimeSettings).toHaveBeenCalledTimes(1);
    expect(stato.refreshSettings).toHaveBeenCalledTimes(1);
  });

  it('selettore e comando di cancellazione chiavi sono collegati', () => {
    const stato = statoHook();
    useAgencySettings.mockReturnValue(stato);
    render(<AgencySettingsPage />);

    fireEvent.change(screen.getByLabelText('Cosa cancellare'), { target: { value: 'openai' } });
    screen.getByRole('button', { name: /Cancella permanentemente/ }).click();

    expect(stato.setClearKeysProvider).toHaveBeenCalledWith('openai');
    expect(stato.handleClearKeys).toHaveBeenCalledTimes(1);
  });

  it('lo stato del salvataggio arriva in pagina', () => {
    useAgencySettings.mockReturnValue(statoHook({
      saveState: { status: 'error', message: 'Salvataggio non riuscito.' },
    }));
    render(<AgencySettingsPage />);

    expect(screen.getByText('Salvataggio non riuscito.')).toHaveAttribute('role', 'alert');
  });
});
