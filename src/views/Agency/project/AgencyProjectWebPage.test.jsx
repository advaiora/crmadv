import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAgencyProjectWeb } from './web/hooks/useAgencyProjectWeb';
import AgencyProjectWebPage from './AgencyProjectWebPage';

// La pagina ormai non ha piu' logica sua: assembla l'hook radice e i riquadri.
// Qui si verifica proprio quell'assemblaggio, quindi si finge l'hook (il suo
// comportamento e' gia' coperto da useAgencyProjectWeb.test.js) e il guscio di
// pagina, che carica dati per conto suo e riguarda tutte e 14 le sotto-pagine.
vi.mock('./web/hooks/useAgencyProjectWeb', () => ({
  useAgencyProjectWeb: vi.fn(),
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

// Si sostituisce SOLO useParams: il resto del router resta quello vero, cosi'
// il giorno che un figlio non finto usa un <Link> il test non si rompe con un
// errore che punta al posto sbagliato.
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useParams: () => ({ projectId: 'p1' }),
}));

const statoHook = (overrides = {}) => ({
  loading: false,
  saving: false,
  generatingAi: false,
  generatingBlockKey: '',
  aiUnavailable: false,
  aiStatus: { configured: true },
  aiEstimates: { loading: false, aiConfigured: false, byFunction: {} },
  dataMeta: null,
  project: { sourceReadiness: { status: 'ready', usedSources: ['sito cliente'], summary: 'Fonti ok' } },
  saveError: '',
  saveMessage: '',
  generationMessage: '',
  webProjectDraft: { type: 'landing', name: '', goal: '', target: '', primaryCta: '' },
  webMissingInputs: [],
  usedSources: ['sito cliente'],
  webState: {
    lastUpdatedAt: '2026-08-04T09:30:00.000Z',
    input: {
      projectType: { key: 'marketing_full', label: 'Marketing completo' },
      contextSummary: 'Contesto',
      discovery: { sections: { target: 'PMI edili', offer: 'Consulenza' } },
    },
    output: {},
  },
  input: {
    projectType: { key: 'marketing_full', label: 'Marketing completo' },
    contextSummary: 'Contesto',
    discovery: { sections: { target: 'PMI edili', offer: 'Consulenza' } },
  },
  output: {
    pageType: 'landing',
    pageGoal: 'Generare richieste',
    ctaSet: { primary: 'Prenota call' },
    sectionPlan: [],
    copyBlocks: {},
    wireframe: { blocks: [] },
    previewHtmlBase: '',
    webProjects: [],
    lastGeneratedAt: '',
  },
  setWebProjectDraft: vi.fn(),
  setOutputField: vi.fn(),
  addWebProject: vi.fn(),
  updateWebProjectStatus: vi.fn(),
  generateForWebProject: vi.fn(),
  loadWeb: vi.fn(),
  handleSave: vi.fn(),
  handleGenerateStructure: vi.fn(),
  handleGenerateCopy: vi.fn(),
  handleGenerateWireframe: vi.fn(),
  handleGeneratePreview: vi.fn(),
  handleRegenerateAll: vi.fn(),
  handleGenerateWithAi: vi.fn(),
  handleGenerateBlockWithAi: vi.fn(),
  ...overrides,
});

const montaCon = (overrides) => {
  useAgencyProjectWeb.mockReturnValue(statoHook(overrides));
  return render(<AgencyProjectWebPage />);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AgencyProjectWebPage', () => {
  it('mentre carica mostra solo l\'avviso di caricamento', () => {
    montaCon({ loading: true, webState: null });

    expect(screen.getByText('Caricamento dei Contenuti Web...')).toBeInTheDocument();
    expect(screen.queryByText('Landing e pagine')).not.toBeInTheDocument();
  });

  it('anche a caricamento finito, senza dati resta sull\'avviso invece di esplodere', () => {
    montaCon({ loading: false, webState: null });

    expect(screen.getByText('Caricamento dei Contenuti Web...')).toBeInTheDocument();
  });

  it('a dati caricati monta tutti i riquadri della pagina', () => {
    montaCon();

    expect(screen.getByText('Landing e pagine')).toBeInTheDocument();
    expect(screen.getByText('Qualita input')).toBeInTheDocument();
    expect(screen.getByText('Impostazioni pagina')).toBeInTheDocument();
    expect(screen.getByText('Contratto generazione')).toBeInTheDocument();
    expect(screen.getByText('Struttura Pagina')).toBeInTheDocument();
    expect(screen.getByText('Copy Base')).toBeInTheDocument();
    // "Wireframe" e "Preview" compaiono due volte: come azione avanzata in cima
    // e come titolo del riquadro di output. Qui si cerca il titolo.
    expect(screen.getByText('Wireframe', { selector: 'h6' })).toBeInTheDocument();
    expect(screen.getByText('Preview', { selector: 'h6' })).toBeInTheDocument();
    expect(screen.getByText('Scegli pagina')).toBeInTheDocument();
  });

  it('senza pagine create suggerisce di crearne una', () => {
    montaCon();

    expect(screen.getByText(/Crea la prima landing o pagina da lavorare\./)).toBeInTheDocument();
  });

  it('con pagine create ma dati mancanti chiede di completare i primi due', () => {
    montaCon({
      webMissingInputs: ['target', 'offerta', 'CTA primaria'],
      output: { ...statoHook().output, webProjects: [{ id: 'web_1', name: 'Landing', type: 'landing', status: 'draft' }] },
    });

    expect(screen.getByText(/Completa target, offerta prima di consegnare\./)).toBeInTheDocument();
  });

  it('con pagine create e input completi propone di rigenerare o salvare', () => {
    montaCon({
      output: { ...statoHook().output, webProjects: [{ id: 'web_1', name: 'Landing', type: 'landing', status: 'draft' }] },
    });

    expect(screen.getByText(/Rigenera il blocco piu importante o salva l'output Web\./)).toBeInTheDocument();
  });

  it('mostra l\'avviso persistente solo con AI non configurata', () => {
    montaCon();
    expect(screen.queryByText(/AI non configurata lato server/)).not.toBeInTheDocument();

    montaCon({ aiUnavailable: true, aiStatus: { configured: false } });
    expect(screen.getByText(/AI non configurata lato server/)).toBeInTheDocument();
  });

  it('inoltra all\'hook il salvataggio chiesto dalla striscia "Prossima azione"', () => {
    const handleSave = vi.fn();
    montaCon({ handleSave });

    // "Salva" e' il pulsante della striscia; quello della barra azioni si
    // chiama "Salva Contenuti Web", ed e' un altro bottone.
    screen.getByRole('button', { name: 'Salva' }).click();

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('passa i messaggi di stato dell\'hook agli alert', () => {
    montaCon({ saveError: 'Salvataggio non riuscito', generationMessage: 'Bozza rigenerata' });

    // Non si cerca per ruolo: anche il pannello delle fonti in cima e' un alert.
    expect(screen.getByText('Salvataggio non riuscito')).toHaveClass('alert-warning');
    expect(screen.getByText('Bozza rigenerata')).toHaveClass('alert-info');
  });
});
