import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AgencyProjectPageTemplate from './AgencyProjectPageTemplate';
import { getAgencyProjectWorkingContext } from '../../../modules/agency-os/data/agencyDataAdapter';

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

// La scheda accesa si riconosce da `aria-current="page"` — che e' anche cio' che
// sente chi usa un lettore di schermo, non solo una classe CSS.
const schedaAccesa = (etichetta) => screen.getByText(etichetta).getAttribute('aria-current') === 'page';

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

describe('barra a quattro gruppi', () => {
  it('mostra le quattro intestazioni', () => {
    renderSuPercorso(PERCORSO_REPORT);

    ['Conoscenza', 'Produzione', 'Risultati', 'Priorita'].forEach((titolo) => {
      expect(screen.getByText(titolo)).toBeInTheDocument();
    });
  });

  it('mette la Panoramica sopra le altre, larga', () => {
    renderSuPercorso(PERCORSO_REPORT);

    expect(screen.getByText('Panoramica').className).toContain('agency-project-tab-wide');
  });

  it('usa i nomi decisi, non piu\' quelli in gergo', () => {
    renderSuPercorso(PERCORSO_REPORT);

    ['Fonti', 'Brief', 'Memoria', 'Contenuti Web', 'Campagne ADS', 'Performance', 'Report', 'Da risolvere', 'Task', 'Opportunita']
      .forEach((etichetta) => expect(screen.getByText(etichetta)).toBeInTheDocument());
  });

  it('le vecchie etichette non compaiono piu\' da nessuna parte', () => {
    renderSuPercorso(PERCORSO_REPORT);

    ['Overview', 'Discovery', 'Memory', 'Ads', 'Alert', 'Diagnosis', 'Reports tecnici', 'Brain']
      .forEach((etichetta) => expect(screen.queryByText(etichetta)).not.toBeInTheDocument());
  });

  it('accende una sola scheda per volta', () => {
    // Un solo accento per vista: se se ne accendessero due, l'utente non saprebbe
    // dove si trova.
    renderSuPercorso(PERCORSO_REPORT);

    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });
});

describe('pallini sulle voci di Priorita', () => {
  it('accende un pallino per ogni voce che ha qualcosa in sospeso', async () => {
    // I tre elenchi arrivano dal contesto di lavoro, che la barra carica gia' per
    // la testata: i pallini non costano nessuna chiamata in piu'.
    getAgencyProjectWorkingContext.mockResolvedValueOnce({
      alerts: [{ id: 'a1', severity: 'critical', status: 'open' }],
      tasks: [{ id: 't1', priority: 'high', status: 'todo' }],
      opportunities: [{ id: 'o1', status: 'open' }],
    });

    renderSuPercorso(PERCORSO_REPORT);

    // Il testo per i lettori di schermo e' la prova che il pallino non comunica
    // con il solo colore.
    expect(await screen.findByText(/1 segnalazione da risolvere/)).toBeInTheDocument();
    expect(screen.getByText(/1 task importante da chiudere/)).toBeInTheDocument();
    expect(screen.getByText(/1 opportunita da valutare/)).toBeInTheDocument();
  });

  it('senza niente in sospeso i pallini restano, ma spenti', async () => {
    // Il pallino spento non sparisce: se sparisse, l'assenza di segnale si
    // confonderebbe con "questa voce non ha pallini", e la barra si sposterebbe
    // ogni volta che un segnale si accende.
    getAgencyProjectWorkingContext.mockResolvedValueOnce({
      alerts: [{ id: 'a1', status: 'resolved' }],
      tasks: [{ id: 't1', priority: 'low', status: 'todo' }],
      opportunities: [],
    });

    renderSuPercorso(PERCORSO_REPORT);

    await screen.findByText('Progetto Demo');
    expect(document.querySelectorAll('.agency-project-tab-dot')).toHaveLength(3);
    expect(document.querySelectorAll('.agency-project-tab-dot-off')).toHaveLength(3);
    // Niente da annunciare a chi usa un lettore di schermo quando non c'e' nulla.
    expect(screen.queryByText(/da risolvere$/)).not.toBeInTheDocument();
  });

  it('i pallini stanno solo sulle tre voci di Priorita', async () => {
    renderSuPercorso(PERCORSO_REPORT);

    await screen.findByText('Progetto Demo');
    expect(document.querySelectorAll('.agency-project-tab-dot')).toHaveLength(3);
  });

  it('il testo sta sulla voce, non sul pallino (un bersaglio da 7px non si prende)', async () => {
    getAgencyProjectWorkingContext.mockResolvedValueOnce({
      alerts: [{ id: 'a1', severity: 'critical', status: 'open' }],
      tasks: [],
      opportunities: [],
    });

    renderSuPercorso(PERCORSO_REPORT);

    const voce = await screen.findByText('Da risolvere');
    expect(voce.closest('a')).toHaveAttribute('title', '1 segnalazione da risolvere');
  });
});

describe('scheda Memoria promossa', () => {
  it('sta nella barra principale, non nel pieghevole tecnico', () => {
    // Promossa il 6/8/2026: era visibile solo in sviluppo, cioe' in produzione non
    // la vedeva nessuno. Il test guarda DOVE sta, non solo che esista: dentro il
    // pieghevole "Diagnosi e strumenti tecnici" sarebbe raggiungibile ma di fatto
    // nascosta, e la promozione non avrebbe ottenuto niente.
    renderSuPercorso(PERCORSO_REPORT);

    const memoria = screen.getByText('Memoria');
    expect(memoria).toBeInTheDocument();
    expect(memoria.closest('details')).toBeNull();
  });

  it('si accende quando ci si trova sul suo percorso', () => {
    renderSuPercorso('/agency/projects/p1/memory');

    expect(schedaAccesa('Memoria')).toBe(true);
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
