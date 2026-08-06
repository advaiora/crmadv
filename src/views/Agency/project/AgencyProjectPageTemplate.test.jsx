import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AgencyProjectPageTemplate from './AgencyProjectPageTemplate';

// Questo test presidia la regola su cui poggia la fusione del 6/8/2026: la scheda
// attiva si decide guardando SOLO il percorso, ignorando la coda dell'indirizzo.
// E' cio' che permette a una scheda di ospitare due viste (Report generale e Report
// tecnico) senza spegnersi. Se un domani qualcuno facesse dipendere la scheda
// attiva anche dalla querystring, o spostasse la vista tecnica su un percorso a se',
// questo test lo ferma prima che il difetto torni a video.

// Il progetto arriva con lo stato delle fonti valorizzato apposta: e' l'unico modo
// per far percorrere ai test il ramo che disegna il pannello sulla qualita' delle
// fonti (riga 207 del template), quello che la vista tecnica del Report ha smesso
// di disegnarsi da sola il 6/8/2026 perche' compariva due volte.
vi.mock('../../../modules/agency-os/data/agencyDataAdapter', () => ({
  getAgencyProject: vi.fn(() => Promise.resolve({
    id: 'p1',
    name: 'Progetto Demo',
    sourceReadiness: { status: 'partial', summary: 'Sito registrato, materiali parziali.', usedSources: ['sito'] },
  })),
  getAgencyProjectWorkingContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../AgencyPageShell', () => ({
  default: ({ children }) => <div data-testid="page-shell">{children}</div>,
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useParams: () => ({ projectId: 'p1' }),
}));

const PERCORSO_REPORT = '/agency/projects/p1/reports/client';

const renderSuPercorso = (indirizzo) => render(
  <MemoryRouter initialEntries={[indirizzo]}>
    <AgencyProjectPageTemplate title="Report" subtitle="Sottotitolo" dataMeta={null}>
      <p>contenuto</p>
    </AgencyProjectPageTemplate>
  </MemoryRouter>,
);

// La scheda accesa e' un Link con la classe `btn-primary`; le altre hanno
// `btn-outline-secondary`.
const schedaAccesa = (etichetta) => screen.getByText(etichetta).className.includes('btn-primary');

describe('scheda attiva nella barra del progetto', () => {
  it('accende "Report" sul suo percorso', () => {
    renderSuPercorso(PERCORSO_REPORT);

    expect(schedaAccesa('Report')).toBe(true);
  });

  it('tiene accesa "Report" anche con un parametro in coda', () => {
    // E' il caso della vista tecnica (?vista=tecnica): l'utente deve continuare a
    // vedere di essere dentro "Report".
    renderSuPercorso(`${PERCORSO_REPORT}?vista=tecnica`);

    expect(schedaAccesa('Report')).toBe(true);
  });

  it('non accende le altre schede mentre si guarda il Report', () => {
    renderSuPercorso(`${PERCORSO_REPORT}?vista=tecnica`);

    expect(schedaAccesa('Fonti')).toBe(false);
    expect(schedaAccesa('Performance')).toBe(false);
  });

  it('su un altro percorso "Report" si spegne', () => {
    renderSuPercorso('/agency/projects/p1/performance');

    expect(schedaAccesa('Report')).toBe(false);
    expect(schedaAccesa('Performance')).toBe(true);
  });
});

describe('scheda Memory promossa', () => {
  it('sta nella barra principale, non nel pieghevole tecnico', () => {
    // Promossa il 6/8/2026: era visibile solo in sviluppo, cioe' in produzione non
    // la vedeva nessuno. Il test guarda DOVE sta, non solo che esista: dentro il
    // pieghevole "Diagnosi e strumenti tecnici" sarebbe raggiungibile ma di fatto
    // nascosta, e la promozione non avrebbe ottenuto niente.
    renderSuPercorso(PERCORSO_REPORT);

    const memoria = screen.getByText('Memory');
    expect(memoria).toBeInTheDocument();
    expect(memoria.closest('details')).toBeNull();
  });

  it('si accende quando ci si trova sul suo percorso', () => {
    renderSuPercorso('/agency/projects/p1/memory');

    expect(schedaAccesa('Memory')).toBe(true);
  });
});

describe('pannello sulla qualita delle fonti', () => {
  it('lo disegna il template, una volta sola', async () => {
    // E' il motivo per cui la vista tecnica del Report ha smesso di disegnarselo:
    // sommato a quello del template ne mostrava due. Se un domani il template
    // smettesse di renderlo, la vista tecnica resterebbe senza e nessuno se ne
    // accorgerebbe — questo test lo impedisce.
    renderSuPercorso(`${PERCORSO_REPORT}?vista=tecnica`);

    const pannelli = await screen.findAllByText(/Qualita delle fonti/);
    expect(pannelli).toHaveLength(1);
  });

  it('non lo disegna sulla scheda Fonti, che gia parla di quello', async () => {
    renderSuPercorso('/agency/projects/p1/assets');

    // Si aspetta che il progetto sia arrivato, poi si verifica che il pannello
    // non ci sia: senza l'attesa il test passerebbe anche a caricamento in corso.
    await screen.findByText('Progetto Demo');
    expect(screen.queryByText(/Qualita delle fonti/)).not.toBeInTheDocument();
  });
});
