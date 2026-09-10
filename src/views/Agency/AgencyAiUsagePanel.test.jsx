// CRMA-56: la ricerca competitor deve comparire nel rendiconto "Consumi & costi
// AI" con l'etichetta italiana decisa (D3), e portare accanto la nota che
// avverte che il costo mostrato e' una sottostima (D2, copre solo i token, non
// la ricerca web) — nota che non deve comparire sulle altre funzioni.
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AgencyAiUsagePanel from './AgencyAiUsagePanel';
import { getAgencyAiUsage } from '../../modules/agency-os/data/agencyDataAdapter';

vi.mock('../../modules/agency-os/data/agencyDataAdapter', () => ({
  getAgencyAiUsage: vi.fn(),
}));

const USAGE_CON_RICERCA_COMPETITOR = {
  windowDays: 30,
  totals: { calls: 5, costUsd: 0.42, inputTokens: 1000, outputTokens: 500 },
  perUser: [],
  perFunction: [
    {
      functionName: 'discovery.generateBrief',
      calls: 2,
      costUsd: 0.1,
      inputTokens: 400,
      outputTokens: 200,
      lastCallAt: '2026-09-01T10:00:00.000Z',
    },
    {
      functionName: 'competitors.search',
      calls: 3,
      costUsd: 0.32,
      inputTokens: 600,
      outputTokens: 300,
      lastCallAt: '2026-09-02T10:00:00.000Z',
    },
  ],
  perProject: [],
  recent: [],
  // Il filtro per funzione si testa separatamente: qui lasciarlo vuoto evita un
  // secondo "Ricerca competitor online" nel menu a tendina, che duplicherebbe
  // il match e farebbe fallire le query per testo.
  options: { users: [], models: [], functions: [], projects: [] },
};

describe('AgencyAiUsagePanel — riga "Ricerca competitor online"', () => {
  it('mostra l\'etichetta italiana e la nota di sottostima solo su quella riga', async () => {
    getAgencyAiUsage.mockResolvedValue(USAGE_CON_RICERCA_COMPETITOR);

    render(<AgencyAiUsagePanel />);

    const etichetta = await screen.findByText('Ricerca competitor online');
    expect(etichetta).toBeInTheDocument();

    const nota = screen.getByText(/non include la ricerca sul web/i);
    expect(nota).toBeInTheDocument();

    // La nota vive nella stessa cella della riga "Ricerca competitor online",
    // non in quella di "Brief completo".
    const rigaCompetitor = etichetta.closest('td');
    expect(rigaCompetitor).toContainElement(nota);

    const rigaBrief = screen.getByText('Brief completo').closest('td');
    expect(rigaBrief).not.toContainElement(nota);
  });

  it('senza consumi di competitor non mostra la nota di sottostima', async () => {
    getAgencyAiUsage.mockResolvedValue({
      ...USAGE_CON_RICERCA_COMPETITOR,
      perFunction: USAGE_CON_RICERCA_COMPETITOR.perFunction.filter(
        (row) => row.functionName !== 'competitors.search',
      ),
    });

    render(<AgencyAiUsagePanel />);

    await screen.findByText('Brief completo');
    expect(screen.queryByText(/non include la ricerca sul web/i)).not.toBeInTheDocument();
  });
});
