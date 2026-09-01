// La regola della «Prova connessione» verso la rete interna, tenuta fuori dal
// servizio perche' e' una politica — quando si rifiuta e cosa si dice — mentre
// il servizio e' la sequenza delle operazioni. Averla qui la rende leggibile
// tutta insieme, che e' la condizione per accorgersi se un giorno si buca.
//
// Il perche' sta in `decisioni-cliente-e-menu-2026-08-07.md` §7.7 punto 7: chi
// ha `mail.manage` sceglie host e porta e legge cosa risponde, quindi senza una
// regola il pulsante e' una scansione della rete dell'agenzia con un oracolo.

import type { EsitoConfigurazionePosta } from '../../core/mail.js';
import { mentionsPrivateIpAddress } from '../../core/net-guard.js';

/**
 * Il testo del rifiuto quando l'indirizzo e' di rete privata e la connessione
 * non e' mai partita.
 *
 * Non nomina l'interruttore che lo autorizza e non dice a quale IP l'indirizzo
 * abbia risolto: il primo perche' l'etichetta vive nella maschera e scriverla
 * anche qui vorrebbe dire tenerne due copie allineate a mano; il secondo perche'
 * sarebbe di nuovo l'oracolo che questo controllo chiude, in piccolo. Chi
 * disegna la maschera appende la frase sull'interruttore quando
 * `motivo === 'rete_privata'`.
 */
export const ERRORE_RETE_PRIVATA =
  "L'indirizzo del server di posta è dentro una rete privata. La prova non è stata eseguita: nessuna connessione è stata aperta.";

/**
 * Il rifiuto dell'ultimo filtro, quando l'indirizzo era pubblico al controllo e
 * privato al momento della connessione. Testo diverso dal precedente perche' qui
 * la connessione **e' partita**, e scrivere «nessuna connessione e' stata
 * aperta» sarebbe falso. Porta lo stesso `motivo`, e a ragione: per chi ha
 * davvero il server dentro la propria rete il rimedio e' lo stesso interruttore.
 */
export const ERRORE_RETE_PRIVATA_ALLA_CONNESSIONE =
  'Il server di posta ha risposto da un indirizzo di rete privata. La prova è stata interrotta.';

/**
 * Se questa configurazione va sottoposta al controllo, cioe' se l'host lo ha
 * scelto chi preme il pulsante e non lo ha ancora autorizzato.
 *
 * ⚠️ Vale SOLO per `source: 'database'`, ed e' il confine piu' delicato di tutto
 * il controllo. Il motivo NON e' «con il `.env` l'indirizzo lo ha scritto chi
 * amministra»: quella e' la conseguenza. La regola e' che oggi il ramo del
 * database e' l'UNICO in cui l'host arriva da un campo che compila chi preme il
 * pulsante — con il `.env` i parametri sono presi in blocco dalle variabili
 * d'ambiente, che nessuna rotta scrive. `source` racconta la provenienza dei
 * parametri, non chi ha scelto l'host: il giorno in cui si aggiungera' «prova
 * questi parametri senza salvarli» — funzione naturale su quella pagina —
 * `source` non sara' `'database'` e questa guardia smettera' di applicarsi senza
 * che niente diventi rosso. Chi scrive quella funzione deve passare di qui.
 *
 * L'altra faccia: controllare anche il ramo `.env` lascerebbe un'agenzia con la
 * prova ferma e nessuna casella da spuntare, perche' la casella vive su una riga
 * di database che in quel caso non esiste.
 *
 * L'autorizzazione arriva dalla STESSA lettura che ha prodotto l'host: con due
 * letture separate ci sarebbe una finestra in cui si prova l'indirizzo di una e
 * il permesso dell'altra. Assente = non autorizzato, il dubbio si chiude.
 */
export const richiedeControlloRetePrivata = (
  resolved: Extract<EsitoConfigurazionePosta, { esito: 'ok' }>,
): boolean => resolved.source === 'database' && resolved.retePrivataConsentita !== true;

/**
 * L'ultimo filtro, e non e' ridondante rispetto al primo.
 *
 * Il controllo dell'host risolve il DNS una volta; nodemailer lo risolve una
 * seconda volta per conto suo. Un nome con TTL zero puo' rispondere pubblico al
 * primo e privato al secondo, e allora il messaggio di nodemailer — «connect
 * ECONNREFUSED 10.0.0.5:587» — riporterebbe indietro proprio l'indirizzo interno
 * che tutto questo lavoro tiene nascosto.
 *
 * ⚠️ Non chiude l'attacco: la connessione e' gia' partita, quindi chi prova
 * impara comunque che li' c'e' qualcosa. Toglie l'informazione, non l'oracolo.
 * La chiusura vera e' pinzare l'indirizzo risolto e farlo usare a nodemailer, e
 * vive in un compito suo perche' passa dalle viscere della libreria.
 */
export const messaggioDaNascondere = (messaggio: string): boolean =>
  mentionsPrivateIpAddress(messaggio);
