import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAgencyProjectAssets } from './assets/hooks/useAgencyProjectAssets';
import AgencyProjectAssetsPage from './AgencyProjectAssetsPage';

// Come le due pagine sorelle: la pagina assembla l'hook radice e i riquadri, e
// qui si verifica proprio l'assemblaggio. Si finge l'hook (coperto da
// useAgencyProjectAssets.test.js) e il guscio di pagina.
vi.mock('./assets/hooks/useAgencyProjectAssets', () => ({
  useAgencyProjectAssets: vi.fn(),
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

// Differenza dalle sorelle: questo riquadro carica i propri dati per conto suo,
// quindi va finto o proverebbe a chiamare il server.
vi.mock('../../../modules/sources/ui/ProjectAiSourcesPanel', () => ({
  default: () => <div data-testid="pannello-fonti-ai" />,
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useParams: () => ({ projectId: 'p1' }),
}));

const sources = {
  sourceStatus: 'partial',
  sourceSummary: 'Sito principale registrato.',
  primaryWebsiteUrl: 'https://cliente.it',
  websiteUrl: 'https://cliente.it',
  manualNotes: 'Appunti di call',
  urls: [{ id: 'url_1', url: 'https://cliente.it', type: 'website', label: 'Sito', status: 'active', notes: '' }],
  uploadedFiles: [],
  competitors: [],
  competitorUrls: [],
};

const statoHook = (overrides = {}) => ({
  loading: false,
  saving: false,
  searching: false,
  uploading: false,
  dataMeta: null,
  message: '',
  error: '',
  sources,
  status: 'partial',
  competitorUrlsText: '',
  setCompetitorUrlsText: vi.fn(),
  uploadedFiles: [],
  competitorRoster: [],
  competitorSearch: null,
  competitorSearchSuggestions: [],
  uploadQueue: [],
  fileDraft: { name: '', type: '', notes: '' },
  setFileDraft: vi.fn(),
  fileActionId: '',
  competitorDraft: { name: '', url: '', reason: '' },
  setCompetitorDraft: vi.fn(),
  getRootProps: () => ({}),
  getInputProps: () => ({}),
  isDragActive: false,
  loadSources: vi.fn(),
  handleSave: vi.fn(),
  updateSourceField: vi.fn(),
  addUrlSource: vi.fn(),
  updateUrlSource: vi.fn(),
  removeUrlSource: vi.fn(),
  setPrimaryUrlSource: vi.fn(),
  addFileMetadata: vi.fn(),
  removeFile: vi.fn(),
  updateFileMetadata: vi.fn(),
  openOrDownloadFile: vi.fn(),
  uploadQueuedFiles: vi.fn(),
  clearUploadQueue: vi.fn(),
  addManualCompetitor: vi.fn(),
  addSuggestedCompetitor: vi.fn(),
  updateCompetitorStatus: vi.fn(),
  removeCompetitor: vi.fn(),
  runCompetitorSearch: vi.fn(),
  ...overrides,
});

// Serve un router vero attorno: a differenza delle pagine sorelle, qui la
// striscia in cima ha un collegamento ad "Apri Discovery".
const montaCon = (overrides) => {
  useAgencyProjectAssets.mockReturnValue(statoHook(overrides));
  return render(<MemoryRouter><AgencyProjectAssetsPage /></MemoryRouter>);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AgencyProjectAssetsPage', () => {
  it('mentre carica mostra solo l\'avviso di caricamento', () => {
    montaCon({ loading: true, sources: null });

    expect(screen.getByText('Caricamento fonti progetto...')).toBeInTheDocument();
    expect(screen.queryByText('URL progetto')).not.toBeInTheDocument();
  });

  it('anche a caricamento finito, senza dati resta sull\'avviso invece di esplodere', () => {
    montaCon({ loading: false, sources: null });

    expect(screen.getByText('Caricamento fonti progetto...')).toBeInTheDocument();
  });

  it('a dati caricati monta tutti i riquadri della pagina', () => {
    montaCon();

    expect(screen.getByText('URL progetto')).toBeInTheDocument();
    expect(screen.getByText('Brief grezzo / note')).toBeInTheDocument();
    expect(screen.getByText('File progetto')).toBeInTheDocument();
    expect(screen.getByText('Competitor')).toBeInTheDocument();
    expect(screen.getByTestId('pannello-fonti-ai')).toBeInTheDocument();
    expect(screen.getByText('Registra link')).toBeInTheDocument();
  });

  it('con fonti pronte propone il passo successivo, altrimenti chiede di completarle', () => {
    montaCon({ status: 'ready' });
    expect(screen.getByText(/Rigenera Discovery o passa a Web\/Ads/)).toBeInTheDocument();

    montaCon({ status: 'partial' });
    expect(screen.getByText(/Completa almeno URL principale/)).toBeInTheDocument();
  });

  it('senza fonti registrate l\'avviso in cima e\' rosso, a fonti pronte sparisce', () => {
    const { container } = montaCon({ status: 'missing' });
    expect(container.querySelector('.alert-danger')).toBeInTheDocument();

    const pronte = montaCon({ status: 'ready' });
    expect(pronte.container.querySelector('.alert-danger')).toBeNull();
  });

  it('mostra il messaggio informativo prima dell\'errore, come faceva prima', () => {
    // Fonti "ready" apposta: cosi' l'avviso di stato non c'e' e restano solo
    // i due che interessano.
    const { container } = montaCon({
      status: 'ready',
      message: 'File caricato rimosso.',
      error: 'Salvataggio non riuscito',
    });

    const avvisi = Array.from(container.querySelectorAll('.alert')).map((entry) => entry.className);

    // Prima l'informazione (blu), poi l'errore (giallo): e' l'ordine
    // dell'originale, ed e' il motivo per cui questa pagina non usa il
    // pannello condiviso, che li mette al contrario.
    expect(avvisi).toHaveLength(2);
    expect(avvisi[0]).toContain('alert-info');
    expect(avvisi[1]).toContain('alert-warning');
  });

  it('inoltra all\'hook il salvataggio e la ricerca competitor', () => {
    const handleSave = vi.fn();
    const runCompetitorSearch = vi.fn();
    montaCon({ handleSave, runCompetitorSearch });

    screen.getByRole('button', { name: 'Aggiorna fonti' }).click();
    screen.getAllByRole('button', { name: /Cerca competitor/ })[0].click();

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(runCompetitorSearch).toHaveBeenCalledTimes(1);
  });

  it('la striscia "Prossima azione" non raddoppia il margine dentro la griglia', () => {
    montaCon();

    const striscia = document.querySelector('.agency-action-strip');
    expect(striscia.className).toBe('agency-action-strip');
  });

  it('collega la casella dei competitor rapidi al suo setter, in lettura e in scrittura', () => {
    const setCompetitorUrlsText = vi.fn();
    montaCon({ competitorUrlsText: 'https://rivale.it', setCompetitorUrlsText });

    const casella = screen.getByLabelText('Competitor URL rapidi');
    expect(casella).toHaveValue('https://rivale.it');

    fireEvent.change(casella, { target: { value: 'https://altro.it' } });
    expect(setCompetitorUrlsText).toHaveBeenCalledWith('https://altro.it');
  });

  it('il brief grezzo finisce nel campo giusto delle fonti', () => {
    const updateSourceField = vi.fn();
    montaCon({ updateSourceField });

    fireEvent.change(screen.getByLabelText('Brief grezzo / note'), { target: { value: 'Nuovi appunti' } });

    // Il nome del campo vive solo nella pagina: un refuso qui e il brief si
    // scriverebbe a video senza arrivare mai al salvataggio.
    expect(updateSourceField).toHaveBeenCalledWith('manualNotes', 'Nuovi appunti');
  });

  it('scrivere in una bozza non azzera gli altri campi della stessa bozza', () => {
    const setCompetitorDraft = vi.fn();
    montaCon({ competitorDraft: { name: 'Rivale', url: '', reason: 'Concorrente diretto' }, setCompetitorDraft });

    fireEvent.change(screen.getByPlaceholderText('https://competitor.it'), { target: { value: 'https://rivale.it' } });

    // La pagina passa una funzione di aggiornamento: si esegue per verificare
    // che diffonda il resto della bozza invece di sostituirla.
    const aggiorna = setCompetitorDraft.mock.calls[0][0];
    expect(aggiorna({ name: 'Rivale', url: '', reason: 'Concorrente diretto' })).toEqual({
      name: 'Rivale',
      url: 'https://rivale.it',
      reason: 'Concorrente diretto',
    });
  });

  it('gli elenchi arrivano ai riquadri giusti, non solo quando sono vuoti', () => {
    montaCon({
      uploadedFiles: [{ id: 'f1', name: 'brief.pdf', size: 1024, parseStatus: 'parsed' }],
      competitorRoster: [{ id: 'c1', name: 'Rivale spa', url: 'https://rivale.it', source: 'manual', status: 'confirmed' }],
      competitorSearchSuggestions: [{ id: 's1', name: 'Proposto srl', url: 'https://proposto.it' }],
    });

    // Con liste vuote un nome di prop sbagliato darebbe lo stesso risultato:
    // servono contenuti riconoscibili. `competitorRoster` e' il piu' esposto,
    // perche' e' una rinomina rispetto all'originale.
    expect(screen.getByText('brief.pdf')).toBeInTheDocument();
    expect(screen.getByText('Rivale spa')).toBeInTheDocument();
    expect(screen.getByText('Proposto srl')).toBeInTheDocument();
  });
});
