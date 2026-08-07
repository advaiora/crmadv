import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAgencyProjectAds } from './ads/hooks/useAgencyProjectAds';
import AgencyProjectAdsPage from './AgencyProjectAdsPage';

// Come la gemella Web: la pagina non ha piu' logica sua, assembla l'hook radice
// e i riquadri. Qui si verifica l'assemblaggio, quindi si finge l'hook (coperto
// da useAgencyProjectAds.test.js) e il guscio di pagina, che carica dati per
// conto suo e riguarda tutte e 14 le sotto-pagine.
vi.mock('./ads/hooks/useAgencyProjectAds', () => ({
  useAgencyProjectAds: vi.fn(),
}));

vi.mock('./AgencyProjectPageTemplate', () => ({
  default: ({ title, subtitle, children }) => (
    <div data-testid="page-template">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useParams: () => ({ projectId: 'p1' }),
}));

const input = {
  projectType: { key: 'marketing_full', label: 'Marketing completo' },
  contextSummary: 'Contesto',
  discovery: { sections: { target: 'PMI edili', offer: 'Consulenza' } },
  activeModules: [{ key: 'ads', label: 'Ads', active: true }],
  alerts: [],
  opportunities: [],
  web: { available: true, ctaPrimary: 'Prenota call', pageType: 'landing', pageGoal: 'Lead', landingRecommendationBase: '' },
};

const output = {
  channelScope: 'google',
  campaignGoal: 'lead_generation',
  targetingSummary: '',
  offerAngle: '',
  notes: '',
  adsProjects: [],
  assetRequests: [],
  launchChecklist: [],
  messageHooks: [],
  adCopyBlocks: { google: [], meta: [] },
  googleAds: {
    campaignType: '',
    campaignStructure: '',
    keywordSeeds: [],
    negativeSeeds: [],
    extensionsIdeas: [],
    landingRecommendation: '',
    adGroups: [],
    rsaIdeas: [],
  },
  metaAds: {
    campaignAngle: '',
    audienceIdeas: [],
    creativeAngles: [],
    hooks: [],
    primaryTexts: [],
    headlines: [],
    ctaIdeas: [],
    assetRequests: [],
  },
  lastGeneratedAt: '',
};

const statoHook = (overrides = {}) => ({
  loading: false,
  saving: false,
  generatingAssetKey: '',
  aiUnavailable: false,
  aiStatus: { configured: true },
  aiEstimates: { loading: false, aiConfigured: false, byFunction: {} },
  dataMeta: null,
  project: { sourceReadiness: { status: 'ready', usedSources: ['sito cliente'], summary: 'Fonti ok' } },
  saveError: '',
  saveMessage: '',
  runtimeMessage: '',
  // Non vuoto di proposito: e' l'unico modo per accorgersi se il menu delle
  // landing venisse collegato a `output.webProjects` (che su Ads non esiste)
  // invece che alla lista del modulo Web.
  webProjects: [{ id: 'web_1', name: 'Landing turni' }],
  adsProjectDraft: { channel: 'google', campaignType: '', name: '', goal: '', linkedWebProjectId: '' },
  completeness: { label: 'completo', tone: 'success', missing: [] },
  linkedLanding: 'landing | Lead',
  adsState: { lastUpdatedAt: '2026-08-04T09:30:00.000Z', input, output },
  input,
  output,
  setAdsProjectDraft: vi.fn(),
  setOutputField: vi.fn(),
  addAdsProject: vi.fn(),
  updateAdsProjectStatus: vi.fn(),
  generateForAdsProject: vi.fn(),
  loadAds: vi.fn(),
  handleSave: vi.fn(),
  handleGenerateGoogleAds: vi.fn(),
  handleGenerateMetaAds: vi.fn(),
  handleGenerateOperationalPlan: vi.fn(),
  handleRegeneratePlaceholder: vi.fn(),
  handleGenerateAdsAssetWithAi: vi.fn(),
  ...overrides,
});

const montaCon = (overrides) => {
  useAgencyProjectAds.mockReturnValue(statoHook(overrides));
  return render(<AgencyProjectAdsPage />);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AgencyProjectAdsPage', () => {
  it('mentre carica mostra solo l\'avviso di caricamento', () => {
    montaCon({ loading: true, adsState: null });

    expect(screen.getByText('Caricamento delle Campagne ADS...')).toBeInTheDocument();
    expect(screen.queryByText('Campagne Ads')).not.toBeInTheDocument();
  });

  it('anche a caricamento finito, senza dati resta sull\'avviso invece di esplodere', () => {
    montaCon({ loading: false, adsState: null });

    expect(screen.getByText('Caricamento delle Campagne ADS...')).toBeInTheDocument();
  });

  it('a dati caricati monta tutti i riquadri della pagina', () => {
    montaCon();

    expect(screen.getByText('Campagne Ads')).toBeInTheDocument();
    expect(screen.getByText('Qualita input')).toBeInTheDocument();
    expect(screen.getByText('Impostazioni campagna')).toBeInTheDocument();
    expect(screen.getByText('Google Ads', { selector: 'h6' })).toBeInTheDocument();
    expect(screen.getByText('Meta Ads', { selector: 'h6' })).toBeInTheDocument();
    expect(screen.getByText('Richieste asset')).toBeInTheDocument();
    expect(screen.getByText('Checklist lancio')).toBeInTheDocument();
    expect(screen.getByText('Hook messaggio')).toBeInTheDocument();
    expect(screen.getByText('Segnali operativi')).toBeInTheDocument();
    expect(screen.getByText('Scegli campagna')).toBeInTheDocument();
  });

  it('senza campagne create suggerisce di crearne una', () => {
    montaCon();

    expect(screen.getByText(/Crea la prima campagna collegata al progetto\./)).toBeInTheDocument();
  });

  it('con campagne create ma dati mancanti chiede di completare i primi due', () => {
    montaCon({
      completeness: { label: 'input parziali', tone: 'warning', missing: ['target', 'offerta', 'CTA'] },
      output: { ...output, adsProjects: [{ id: 'ads_1', name: 'Brand', channel: 'google', status: 'draft' }] },
    });

    expect(screen.getByText(/Completa target, offerta prima del setup\./)).toBeInTheDocument();
  });

  it('con campagne create e input completi propone di generare o salvare', () => {
    montaCon({
      output: { ...output, adsProjects: [{ id: 'ads_1', name: 'Brand', channel: 'google', status: 'draft' }] },
    });

    expect(screen.getByText(/Genera asset specifici o salva la campagna\./)).toBeInTheDocument();
  });

  it('mostra nel banner in cima il giudizio sugli input e cosa manca', () => {
    montaCon({
      completeness: { label: 'input parziali', tone: 'warning', missing: ['tracking', 'area geografica'] },
    });

    expect(screen.getByText(/Qualita input Ads:/)).toBeInTheDocument();
    expect(screen.getByText(/Mancano o sono deboli: tracking, area geografica/)).toBeInTheDocument();
  });

  it('elenca fra le landing collegabili quelle del modulo Web, non quelle dell\'output Ads', () => {
    montaCon();

    expect(screen.getByText('Landing turni', { selector: 'option' })).toBeInTheDocument();
  });

  it('non mostra l\'avviso persistente "AI non configurata" della pagina Web', () => {
    montaCon({ aiUnavailable: true, aiStatus: { configured: false } });

    expect(screen.queryByText(/AI non configurata lato server/)).not.toBeInTheDocument();
  });

  it('senza AI disponibile spegne i pulsanti di rigenerazione asset', () => {
    montaCon();
    expect(screen.getByText('Headline', { selector: 'button' })).toBeEnabled();

    montaCon({ aiUnavailable: true, aiStatus: { configured: false } });
    expect(screen.getAllByText('Headline', { selector: 'button' }).at(-1)).toBeDisabled();
  });

  it('inoltra all\'hook il salvataggio chiesto dalla striscia "Prossima azione"', () => {
    const handleSave = vi.fn();
    montaCon({ handleSave });

    screen.getByRole('button', { name: 'Salva Campagne ADS' }).click();

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('passa i messaggi di stato dell\'hook agli alert', () => {
    montaCon({ saveError: 'Salvataggio non riuscito', runtimeMessage: 'Bozza rigenerata' });

    // Non si cerca per ruolo: anche il pannello delle fonti in cima e' un alert.
    expect(screen.getByText('Salvataggio non riuscito')).toHaveClass('alert-warning');
    expect(screen.getByText('Bozza rigenerata')).toHaveClass('alert-info');
  });
});
