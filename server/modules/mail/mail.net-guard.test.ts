import assert from 'node:assert/strict';
import test from 'node:test';
import type { EsitoConfigurazionePosta } from '../../core/mail.js';
import {
  ERRORE_RETE_PRIVATA,
  ERRORE_RETE_PRIVATA_ALLA_CONNESSIONE,
  messaggioDaNascondere,
  richiedeControlloRetePrivata,
} from './mail.net-guard.js';

const PARAMETRI = {
  host: 'mail.esempio.it',
  port: 587,
  secure: false,
  user: null,
  pass: null,
  from: 'noreply@esempio.it',
};

const daDatabase = (
  retePrivataConsentita?: boolean,
): Extract<EsitoConfigurazionePosta, { esito: 'ok' }> =>
  // Il `as` c'e' per un caso solo, ed e' quello che il test vuole coprire: una
  // riga letta da una versione che il campo non lo conosceva. Il tipo lo vieta —
  // e' proprio la garanzia che si e' voluta — quindi per provare il fail-closed
  // bisogna forzarlo qui.
  ({
    esito: 'ok',
    source: 'database',
    settings: PARAMETRI,
    retePrivataConsentita,
  }) as Extract<EsitoConfigurazionePosta, { esito: 'ok' }>;

const dallAmbiente = (): Extract<EsitoConfigurazionePosta, { esito: 'ok' }> => ({
  esito: 'ok',
  source: 'env',
  settings: PARAMETRI,
});

test('si controlla la configurazione salvata, finche\' non e\' autorizzata', () => {
  assert.equal(richiedeControlloRetePrivata(daDatabase(false)), true);
  assert.equal(richiedeControlloRetePrivata(daDatabase(true)), false);
});

test('non si controllano i parametri del file .env', () => {
  // Li' l'host non lo sceglie chi preme il pulsante, e la casella per
  // autorizzarlo vive su una riga di database che in quel caso non esiste.
  assert.equal(richiedeControlloRetePrivata(dallAmbiente()), false);
});

test('un\'autorizzazione che non arriva vale come spenta', () => {
  // Riga letta da una versione che non conosce ancora il campo, o campo perso
  // per strada: il dubbio si chiude, non si apre.
  assert.equal(richiedeControlloRetePrivata(daDatabase(undefined)), true);
});

// ⚠️ Questo test non dimostra niente sulla logica: due costanti scritte a mano
// diranno sempre quello che ci si e' scritto dentro. Serve come allarme sulle
// modifiche future — se qualcuno ci infila il nome dell'interruttore o un
// indirizzo IP, cosa che sembra sempre utile sul momento, diventa rosso.
test('i due testi del rifiuto dicono due cose diverse, ed e\' voluto', () => {
  // Il primo promette che non e' stata aperta nessuna connessione; il secondo
  // esiste perche' in quel caso la connessione era gia' partita, e ripetere la
  // prima frase sarebbe falso.
  assert.match(ERRORE_RETE_PRIVATA, /nessuna connessione è stata aperta/);
  assert.doesNotMatch(ERRORE_RETE_PRIVATA_ALLA_CONNESSIONE, /nessuna connessione/);
  // Nessuno dei due nomina un controllo della maschera: quell'etichetta la
  // sceglie il consiglio e vive di la'.
  for (const testo of [ERRORE_RETE_PRIVATA, ERRORE_RETE_PRIVATA_ALLA_CONNESSIONE]) {
    assert.doesNotMatch(testo, /spunta|casella|interruttore|autorizza/i);
    assert.doesNotMatch(testo, /\d+\.\d+\.\d+\.\d+/);
  }
});

test('il messaggio da nascondere e\' quello che nomina un indirizzo interno', () => {
  assert.equal(messaggioDaNascondere('connect ECONNREFUSED 10.0.0.5:587'), true);
  assert.equal(messaggioDaNascondere('connect ECONNREFUSED 93.184.216.34:587'), false);
  assert.equal(messaggioDaNascondere('Invalid login: 535 5.7.8 not accepted'), false);
});
