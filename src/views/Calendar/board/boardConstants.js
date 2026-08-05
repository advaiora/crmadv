// Costanti della pagina Calendario: le sorgenti degli eventi (i filtri della
// colonna sinistra) e l'etichetta che ognuna mostra nel dettaglio evento.
// Estratte da src/views/Calendar/index.jsx nel giro di spezzatura del 5/8/2026.

// Le chiavi sono i `sourceType` che arrivano dal server: `custom` sono gli
// eventi creati a mano, gli altri tre sono derivati da progetti e preventivi
// (non modificabili, il server li marca `editable: false`).
export const SOURCE_FILTERS = {
  custom: 'Eventi custom',
  project_due: 'Scadenze progetti',
  quote_issue_date: 'Emissione preventivi',
  quote_valid_until: 'Scadenza preventivi',
};

export const EVENT_SOURCE_BADGE = {
  custom: 'Custom',
  project_due: 'Progetto',
  quote_issue_date: 'Preventivo',
  quote_valid_until: 'Preventivo',
};

// Colore predefinito di un evento nuovo, e ripiego quando quello salvato non e'
// un esadecimale valido. E' un DATO (finisce nel database e nel campo
// `<input type="color">`, che accetta solo esadecimali), non uno stile: qui un
// token del tema non funzionerebbe.
export const DEFAULT_EVENT_COLOR = '#0d6efd';
