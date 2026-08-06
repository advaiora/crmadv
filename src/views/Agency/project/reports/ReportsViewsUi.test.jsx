import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClientReportView from './ClientReportView';
import TechnicalReportView from './TechnicalReportView';
import { useAgencyProjectReportClient } from './hooks/useAgencyProjectReportClient';
import { useAgencyProjectReportTechnical } from './hooks/useAgencyProjectReportTechnical';

// Copre le due viste della scheda "Report" dopo la fusione del 6/8/2026. Il rischio
// che questi test presidiano e' quello tipico di una fusione: che una delle due
// meta' sparisca in silenzio, o che la vista tecnica torni a comportarsi come una
// pagina a se' (requisito posto da Jacopo: deve restare dentro "Report" e si deve
// poter tornare indietro con un pulsante, non col tasto indietro del browser).

vi.mock('./hooks/useAgencyProjectReportClient', () => ({
  useAgencyProjectReportClient: vi.fn(),
}));

vi.mock('./hooks/useAgencyProjectReportTechnical', () => ({
  useAgencyProjectReportTechnical: vi.fn(),
}));

vi.mock('../AgencyProjectPageTemplate', () => ({
  default: ({ title, subtitle, children }) => (
    <div data-testid="page-template">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

const renderConRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

const statoCliente = (overrides = {}) => ({
  report: {
    lastUpdatedAt: '2026-08-06T09:00:00.000Z',
    output: {
      clientReportStatus: 'ready',
      executiveSummary: 'Il progetto procede secondo il piano.',
      projectStatusSummary: 'Tutte le attivita del trimestre sono avviate.',
      workCompletedSummary: ['Landing pubblicata'],
      keyFindings: ['Tracking incompleto'],
      keyOpportunities: ['Estendere le campagne'],
      nextStepsSummary: ['Chiudere il tracking'],
      printableHtml: '<p>Documento</p>',
      generatedAt: '2026-08-06T08:00:00.000Z',
    },
    input: { projectName: 'Progetto Demo', projectStatus: 'active', scopeSummary: ['Web', 'Ads'] },
  },
  dataMeta: null,
  loading: false,
  saving: false,
  downloadingPdf: false,
  saveMessage: '',
  runtimeMessage: '',
  saveError: '',
  load: vi.fn(),
  save: vi.fn(),
  regenerate: vi.fn(),
  print: vi.fn(),
  downloadPdf: vi.fn(),
  ...overrides,
});

const statoTecnico = (overrides = {}) => ({
  report: {
    lastUpdatedAt: '2026-08-06T09:00:00.000Z',
    output: {
      reportStatus: 'ready',
      projectSnapshot: { projectName: 'Progetto Demo', projectStatus: 'active', contextSummary: 'Contesto consolidato.' },
      moduleStatus: [{ key: 'web', label: 'Web', status: 'active', active: true }],
      discoverySummary: { title: 'Brief', summary: 'Brief completo.', status: 'ready', highlights: [] },
      webSummary: { title: 'Contenuti Web', summary: 'Landing pronta.', status: 'ready', highlights: [] },
      adsSummary: { title: 'Campagne ADS', summary: 'Campagne attive.', status: 'partial', highlights: [] },
      topAlerts: [{ id: 'a1', title: 'Tracking incompleto', severity: 'high', status: 'open' }],
      topOpportunities: [],
      topTasks: [{ id: 't1', title: 'Chiudere il tracking', priority: 'high', status: 'todo', teamRole: 'web' }],
      nextSteps: ['Pubblicare la seconda landing'],
      generatedAt: '2026-08-06T08:00:00.000Z',
    },
    input: {},
  },
  dataMeta: null,
  loading: false,
  saving: false,
  saveMessage: '',
  runtimeMessage: '',
  saveError: '',
  load: vi.fn(),
  save: vi.fn(),
  regenerate: vi.fn(),
  ...overrides,
});

describe('ClientReportView — la vista generale', () => {
  it('si presenta come la scheda "Report", non come una pagina a se', () => {
    useAgencyProjectReportClient.mockReturnValue(statoCliente());
    renderConRouter(<ClientReportView projectId="p1" />);

    expect(screen.getByRole('heading', { name: 'Report' })).toBeInTheDocument();
  });

  it('mostra i contenuti pensati per il cliente', () => {
    useAgencyProjectReportClient.mockReturnValue(statoCliente());
    renderConRouter(<ClientReportView projectId="p1" />);

    expect(screen.getByText('Il progetto procede secondo il piano.')).toBeInTheDocument();
    expect(screen.getByText('Landing pubblicata')).toBeInTheDocument();
    expect(screen.getByText('Estendere le campagne')).toBeInTheDocument();
  });

  it('salvataggio, rigenerazione, PDF e stampa sono sopravvissuti alla fusione', () => {
    // La riorganizzazione sposta i contenuti, non toglie funzioni.
    useAgencyProjectReportClient.mockReturnValue(statoCliente());
    renderConRouter(<ClientReportView projectId="p1" />);

    expect(screen.getByRole('button', { name: 'Salva report cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rigenera report cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scarica PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stampa' })).toBeInTheDocument();
  });

  it('porta alla vista tecnica restando sullo stesso percorso', () => {
    useAgencyProjectReportClient.mockReturnValue(statoCliente());
    renderConRouter(<ClientReportView projectId="p1" />);

    // react-bootstrap rende `Button as={Link}` come <a role="button">.
    const link = screen.getByRole('button', { name: 'Vedi la versione tecnica' });
    expect(link).toHaveAttribute('href', '/agency/projects/p1/reports/client?vista=tecnica');
  });

  it('durante il caricamento non mostra i riquadri', () => {
    useAgencyProjectReportClient.mockReturnValue(statoCliente({ loading: true }));
    renderConRouter(<ClientReportView projectId="p1" />);

    expect(screen.getByText(/Caricamento report cliente/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salva report cliente' })).not.toBeInTheDocument();
  });
});

describe('TechnicalReportView — la vista tecnica', () => {
  it('resta dentro la scheda "Report" e dichiara dove ci si trova', () => {
    useAgencyProjectReportTechnical.mockReturnValue(statoTecnico());
    renderConRouter(<TechnicalReportView projectId="p1" />);

    expect(screen.getByRole('heading', { name: 'Report' })).toBeInTheDocument();
    expect(screen.getByText(/versione tecnica/)).toBeInTheDocument();
  });

  it('offre un pulsante esplicito per tornare alla vista generale', () => {
    // Requisito: non si torna indietro col tasto del browser.
    useAgencyProjectReportTechnical.mockReturnValue(statoTecnico());
    renderConRouter(<TechnicalReportView projectId="p1" />);

    const ritorno = screen.getByRole('button', { name: 'Torna al report cliente' });
    expect(ritorno).toHaveAttribute('href', '/agency/projects/p1/reports/client');
  });

  it('il pulsante di ritorno c\'e\' anche mentre i dati caricano', () => {
    // Altrimenti chi arriva da un collegamento diretto resta bloccato per qualche
    // secondo senza via d'uscita.
    useAgencyProjectReportTechnical.mockReturnValue(statoTecnico({ loading: true }));
    renderConRouter(<TechnicalReportView projectId="p1" />);

    expect(screen.getByRole('button', { name: 'Torna al report cliente' })).toBeInTheDocument();
  });

  it('mostra i blocchi tecnici dello snapshot', () => {
    useAgencyProjectReportTechnical.mockReturnValue(statoTecnico());
    renderConRouter(<TechnicalReportView projectId="p1" />);

    expect(screen.getByText('Project Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Stato moduli')).toBeInTheDocument();
    expect(screen.getByText('Tracking incompleto')).toBeInTheDocument();
    expect(screen.getByText('Chiudere il tracking')).toBeInTheDocument();
    expect(screen.getByText('Pubblicare la seconda landing')).toBeInTheDocument();
  });

  it('salvataggio e rigenerazione dello snapshot sono sopravvissuti alla fusione', () => {
    useAgencyProjectReportTechnical.mockReturnValue(statoTecnico());
    renderConRouter(<TechnicalReportView projectId="p1" />);

    expect(screen.getByRole('button', { name: 'Salva snapshot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rigenera snapshot' })).toBeInTheDocument();
  });
});
