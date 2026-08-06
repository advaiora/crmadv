import { describe, expect, it } from 'vitest';
import { AGENCY_REMOVED_ROUTES, sostituisciCoda } from './agencyRemovedRoutes';

// Copre i rimandi nati il 6/8/2026 con la rimozione di tre schede di progetto.
// Sono la rete per chi ha un segnalibro vecchio: se si rompono, quella persona
// finisce su una pagina che non esiste e non ha modo di capire dov'e' finito il
// contenuto.

const rimandoDi = (coda) => AGENCY_REMOVED_ROUTES.find((voce) => voce.coda === coda);

const PROGETTO = '/agency/projects/p1';

describe('sostituisciCoda', () => {
  it('manda la vecchia Diagnosis dentro "Da risolvere"', () => {
    const { coda, destinazione } = rimandoDi('/diagnosis');
    expect(sostituisciCoda(`${PROGETTO}/diagnosis`, coda, destinazione)).toBe(`${PROGETTO}/alerts`);
  });

  it('manda il vecchio Brain in Panoramica', () => {
    const { coda, destinazione } = rimandoDi('/brain');
    expect(sostituisciCoda(`${PROGETTO}/brain`, coda, destinazione)).toBe(`${PROGETTO}/overview`);
  });

  it('manda i vecchi Reports tecnici sulla vista tecnica dentro Report', () => {
    const { coda, destinazione } = rimandoDi('/reports');
    expect(sostituisciCoda(`${PROGETTO}/reports`, coda, destinazione))
      .toBe(`${PROGETTO}/reports/client?vista=tecnica`);
  });

  it('non tocca l\'identificativo del progetto, nemmeno se e\' codificato', () => {
    // Il motivo per cui si sostituisce la coda invece di ricostruire l'indirizzo:
    // qui dentro c'e' gia' uno spazio e una barra codificati, e devono restare tali.
    const url = '/agency/projects/pro%20getto%2F1/brain';
    expect(sostituisciCoda(url, '/brain', '/overview')).toBe('/agency/projects/pro%20getto%2F1/overview');
  });

  it('sostituisce solo in fondo, non a meta strada', () => {
    // Un progetto che si chiamasse "brain" non deve far sparire mezzo indirizzo.
    expect(sostituisciCoda('/agency/projects/brain/brain', '/brain', '/overview'))
      .toBe('/agency/projects/brain/overview');
  });

  it('se la coda non c\'e\', lascia l\'indirizzo dov\'e\'', () => {
    // Meglio restare fermi che mandare l'utente in un posto a caso.
    expect(sostituisciCoda(`${PROGETTO}/overview`, '/brain', '/overview')).toBe(`${PROGETTO}/overview`);
    expect(sostituisciCoda(undefined, '/brain', '/overview')).toBe(undefined);
  });
});

describe('elenco dei rimandi', () => {
  it('copre tutte e tre le schede tolte', () => {
    expect(AGENCY_REMOVED_ROUTES).toHaveLength(3);
    expect(AGENCY_REMOVED_ROUTES.map((voce) => voce.coda))
      .toEqual(['/diagnosis', '/brain', '/reports']);
  });
});
