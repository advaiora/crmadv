import { describe, expect, it } from 'vitest';
import { INTERNAL_MODULE_KEYS, visibleActiveModules, visibleModules } from './moduleVisibility';

// Il rischio che questi test presidiano non e' il filtro in se': e' che qualcuno,
// per ottenere lo stesso effetto a schermo, tolga la voce "brain" dai DATI. Quella
// lista viene passata all'AI come contesto di generazione, ed esiste in due copie
// (la buona sta nel backend). Il filtro deve restare a valle.

const moduli = [
  { key: 'discovery', label: 'Discovery', active: true, included: true },
  { key: 'brain', label: 'Agency Brain', active: true, included: true },
  { key: 'web', label: 'Web', active: true, included: true },
  { key: 'ads', label: 'Ads', active: false, included: false, suggested: true },
];

describe('visibleModules', () => {
  it('nasconde i moduli interni e lascia tutti gli altri', () => {
    expect(visibleModules(moduli).map((entry) => entry.key)).toEqual(['discovery', 'web', 'ads']);
  });

  it('non modifica la lista di partenza', () => {
    // Se la filtrasse sul posto, cambierebbe anche il dato passato all'AI.
    visibleModules(moduli);
    expect(moduli.map((entry) => entry.key)).toEqual(['discovery', 'brain', 'web', 'ads']);
  });

  it('regge liste mancanti o malformate', () => {
    expect(visibleModules(undefined)).toEqual([]);
    expect(visibleModules(null)).toEqual([]);
    expect(visibleModules([{}])).toEqual([{}]);
  });
});

describe('visibleActiveModules', () => {
  it('tiene solo i visibili che sono anche attivi', () => {
    expect(visibleActiveModules(moduli).map((entry) => entry.key)).toEqual(['discovery', 'web']);
  });

  it('il conteggio coincide con quante pastiglie si vedono', () => {
    // E' il punto: un conteggio che include cio' che non si disegna fa sembrare
    // un difetto quello che e' solo un filtro.
    expect(visibleActiveModules(moduli)).toHaveLength(
      visibleModules(moduli).filter((entry) => entry.active).length,
    );
  });
});

describe('elenco dei moduli interni', () => {
  it('contiene brain, e solo quello', () => {
    // Se un domani se ne aggiunge un altro, va aggiunto qui e non sparso nei
    // punti che disegnano: erano cinque, e tenerli allineati a mano non regge.
    expect(INTERNAL_MODULE_KEYS).toEqual(['brain']);
  });
});
