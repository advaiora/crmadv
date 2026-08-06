import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AgencyProjectClientReportPage from './AgencyProjectClientReportPage';

// La scheda "Report" e' uno smistatore: stesso percorso, due viste. Qui si verifica
// che scelga la vista giusta leggendo la coda dell'indirizzo. Le due viste sono
// finte apposta: il loro contenuto e' coperto da reports/ReportsViewsUi.test.jsx,
// e montarle davvero qui farebbe partire le chiamate al server.
vi.mock('./reports/ClientReportView', () => ({
  default: ({ projectId }) => <div data-testid="vista-cliente">{projectId}</div>,
}));

vi.mock('./reports/TechnicalReportView', () => ({
  default: ({ projectId }) => <div data-testid="vista-tecnica">{projectId}</div>,
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useParams: () => ({ projectId: 'p1' }),
}));

const renderAll = (indirizzo) => render(
  <MemoryRouter initialEntries={[indirizzo]}>
    <AgencyProjectClientReportPage />
  </MemoryRouter>,
);

const PERCORSO = '/agency/projects/p1/reports/client';

describe('scheda Report — quale vista si apre', () => {
  it('senza parametro apre il report del cliente', () => {
    renderAll(PERCORSO);

    expect(screen.getByTestId('vista-cliente')).toBeInTheDocument();
    expect(screen.queryByTestId('vista-tecnica')).not.toBeInTheDocument();
  });

  it('con ?vista=tecnica apre la vista tecnica sullo stesso percorso', () => {
    // E' il collegamento diretto: chi ha un segnalibro sulla vista tecnica deve
    // atterrarci senza passare dalla vista generale.
    renderAll(`${PERCORSO}?vista=tecnica`);

    expect(screen.getByTestId('vista-tecnica')).toBeInTheDocument();
    expect(screen.queryByTestId('vista-cliente')).not.toBeInTheDocument();
  });

  it('un parametro storpiato non lascia la scheda vuota', () => {
    renderAll(`${PERCORSO}?vista=sbagliata`);

    expect(screen.getByTestId('vista-cliente')).toBeInTheDocument();
  });

  it('passa il progetto alla vista che monta', () => {
    renderAll(`${PERCORSO}?vista=tecnica`);

    expect(screen.getByTestId('vista-tecnica')).toHaveTextContent('p1');
  });
});
