// Alcuni "moduli" del progetto sono ingranaggi interni, non cose che l'utente
// compra o apre. L'elenco dei moduli serve a due scopi diversi che prima erano
// confusi in uno:
//
//  1. **dato**: viene passato all'AI come contesto quando genera Contenuti Web e
//     Campagne ADS (`normalizeAgencyWebV1Input`, `normalizeAgencyAdsV1Input`), e
//     arriva dal backend (`agency.service.ts`). Qui dentro NON si tocca niente;
//  2. **schermo**: pastiglie e conteggi di "moduli attivi".
//
// Da qui in poi il filtro vale solo per il punto 2. Il 6/8/2026 e' stata tolta
// dalla vista la voce "brain" (era etichettata "Agency Brain"): a differenza di
// Web, Ads e Reports — che dipendono da cosa il cliente ha comprato — e' cablata
// a `included: true, active: true` per ogni progetto, quindi non poteva mai dire
// niente di diverso. Peggio: dopo la rimozione della scheda Brain non c'era
// nemmeno piu' una pagina da aprire dietro quel nome.
//
// ⚠️ Non togliere la voce dai dati per ottenere lo stesso effetto: cambierebbe
// cio' che l'AI riceve, e ci sono due copie dell'elenco (una nel backend, che e'
// quella che comanda). Il filtro sta a valle apposta.
export const INTERNAL_MODULE_KEYS = ["brain"];

const isInternalModule = (entry) => INTERNAL_MODULE_KEYS.includes(entry?.key);

// I moduli da mostrare a schermo. Usala sia per le pastiglie sia per i conteggi:
// un conteggio che include cio' che non si vede fa sembrare un difetto quello che
// e' solo un filtro ("3 moduli attivi" con due pastiglie sotto).
export const visibleModules = (modules) => (
  Array.isArray(modules) ? modules.filter((entry) => !isInternalModule(entry)) : []
);

// Scorciatoia per il caso piu' frequente: quelli visibili E attivi.
export const visibleActiveModules = (modules) => (
  visibleModules(modules).filter((entry) => entry?.active)
);
