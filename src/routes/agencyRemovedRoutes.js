// Le tre schede di progetto tolte il 6/8/2026 — Diagnosis, Brain e Reports tecnici —
// non lasciano pagine "non trovata": le loro rotte restano vive come rimandi verso il
// posto dove il contenuto e' finito.
//
//  - diagnosis → alerts            (l'analisi dei punti deboli e' dentro "Da risolvere")
//  - brain     → overview          (non aggiungeva niente alla Panoramica)
//  - reports   → reports/client?vista=tecnica  (e' la vista tecnica dentro "Report")
export const AGENCY_REMOVED_ROUTES = [
  { coda: "/diagnosis", destinazione: "/alerts" },
  { coda: "/brain", destinazione: "/overview" },
  { coda: "/reports", destinazione: "/reports/client?vista=tecnica" },
];

// Sostituisce la CODA dell'indirizzo, invece di ricostruirlo dall'identificativo del
// progetto. E' voluto: l'indirizzo che arriva dal router e' gia' codificato dal
// browser, quindi un progetto il cui identificativo contiene spazi o barre continua a
// funzionare. Ricostruendolo a mano servirebbe `encodeURIComponent`, ed e' il tipo di
// dettaglio che si dimentica.
//
// Se la coda non c'e' (non dovrebbe succedere: la rotta e' dichiarata con `exact`),
// l'indirizzo torna intatto — meglio restare fermi che mandare l'utente altrove.
export const sostituisciCoda = (url, coda, destinazione) => {
  if (typeof url !== "string" || !url.endsWith(coda)) {
    return url;
  }

  return `${url.slice(0, url.length - coda.length)}${destinazione}`;
};
