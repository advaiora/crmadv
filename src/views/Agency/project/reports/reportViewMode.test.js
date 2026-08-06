import { describe, expect, it } from 'vitest';
import { isTechnicalView, reportViewPath, technicalViewPath } from './reportViewMode';

// La regola che questi test presidiano e' una sola, ed e' la ragione per cui la
// fusione del 6/8/2026 e' stata disegnata cosi': le due viste devono stare sullo
// STESSO percorso. Se qualcuno un domani trasformasse la vista tecnica in un
// percorso a se', la scheda "Report" in cima si spegnerebbe di nuovo.

describe('percorsi delle due viste', () => {
  it('la vista tecnica sta sullo stesso percorso della generale', () => {
    const generale = reportViewPath('p1');
    const tecnica = technicalViewPath('p1');

    expect(tecnica.split('?')[0]).toBe(generale);
  });

  it('la vista generale non porta parametri in coda', () => {
    expect(reportViewPath('p1')).toBe('/agency/projects/p1/reports/client');
  });

  it('la vista tecnica si distingue solo per il parametro', () => {
    expect(technicalViewPath('p1')).toBe('/agency/projects/p1/reports/client?vista=tecnica');
  });

  it('un identificativo con caratteri speciali resta valido nell\'indirizzo', () => {
    expect(reportViewPath('pro getto/1')).toBe('/agency/projects/pro%20getto%2F1/reports/client');
  });
});

describe('isTechnicalView', () => {
  it('riconosce il parametro della vista tecnica', () => {
    expect(isTechnicalView('?vista=tecnica')).toBe(true);
  });

  it('senza parametro sta sulla vista generale', () => {
    expect(isTechnicalView('')).toBe(false);
    expect(isTechnicalView(undefined)).toBe(false);
  });

  it('convive con altri parametri nell\'indirizzo', () => {
    expect(isTechnicalView('?altro=1&vista=tecnica')).toBe(true);
  });

  it('un valore storpiato ripiega sulla vista generale, non su una pagina vuota', () => {
    // Un indirizzo copiato male non deve mai portare al nulla: si mostra il
    // report del cliente, che e' la vista di ingresso della scheda.
    expect(isTechnicalView('?vista=Tecnica')).toBe(false);
    expect(isTechnicalView('?vista=')).toBe(false);
    expect(isTechnicalView('?vista=qualcosaltro')).toBe(false);
  });
});
