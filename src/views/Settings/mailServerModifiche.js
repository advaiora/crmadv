// Le modifiche non ancora salvate della maschera «Server di posta».
//
// Perche' esiste questo file. La prova della connessione gira sul server, e il
// server prova SEMPRE la configurazione salvata: `POST /mail/test` non riceve
// nessun campo dalla maschera (server/modules/mail/routes/workspace-mail.route.ts)
// e legge quello che c'e' a database (mail.service.ts, `resolveSettings`).
// Chi corregge la porta da 587 a 465 e preme subito «Prova connessione» legge
// quindi «connessione riuscita» riferito alla porta vecchia, e conclude che la
// correzione e' buona senza averla mai collaudata. La prova non si cambia: si
// dice come stanno le cose a chi la lancia.
//
// Il confronto qui sotto e' volutamente GENERICO — scorre le chiavi della
// maschera invece di elencare `server` e `porta`. Un campo nuovo entra nel
// confronto per il solo fatto di comparire in `CAMPI_VUOTI`, senza che nessuno
// debba tornare a toccare questa funzione ne' il suo test. Non e' prudenza
// astratta: l'interruttore «Usa questo server per spedire» cadeva gia' fuori da
// un elenco per nome, e la stessa cosa vale per ogni campo che arrivera' dopo.

/** I valori con cui la maschera nasce quando non c'e' niente di salvato. */
export const CAMPI_VUOTI = {
  attivo: true,
  server: '',
  porta: 587,
  connessioneSicura: false,
  utente: '',
  mittente: '',
};

/**
 * Lo stato salvato letto come lo vedrebbe la maschera. Serve a due cose che
 * devono restare la stessa cosa: riempire i campi dopo una lettura o un
 * salvataggio, e fare da termine di paragone per capire se qualcuno ha scritto
 * qualcosa dopo. Se le due mappature divergessero, la pagina segnalerebbe
 * modifiche pendenti appena aperta.
 */
export const campiDaImpostazioni = (impostazioni) =>
  Object.fromEntries(
    Object.keys(CAMPI_VUOTI).map((chiave) => [
      chiave,
      // `??` e non `||`: `utente` torna `null` dal server e diventa stringa
      // vuota, ma un interruttore spento (`false`) deve restare spento.
      impostazioni?.[chiave] ?? CAMPI_VUOTI[chiave],
    ]),
  );

// I campi di testo arrivano dal server gia' ripuliti e vengono ripuliti di
// nuovo al salvataggio: uno spazio di troppo in coda non e' una modifica. La
// porta invece esce dal campo numerico come stringa ("465") e torna dal server
// come numero (465): senza normalizzare, riscrivere lo stesso numero
// risulterebbe una modifica.
const confrontabile = (valore) => {
  if (typeof valore === 'boolean') {
    return valore ? 'acceso' : 'spento';
  }

  if (valore === null || valore === undefined) {
    return '';
  }

  return String(valore).trim();
};

/**
 * `true` se quello che si vede nella maschera non e' piu' quello che il server
 * proverebbe.
 *
 * Torna `false` quando non c'e' ancora niente di salvato: quel caso ha gia' il
 * suo avviso («Salva le impostazioni per poter provare la connessione») e il
 * pulsante spento, e non c'e' nessuna configurazione vecchia da scambiare per
 * quella nuova.
 */
export const ciSonoModifichePendenti = ({ campi, statoSalvato, password = '' }) => {
  if (!statoSalvato?.configurata) {
    return false;
  }

  // La password non torna mai dal server, quindi non e' confrontabile: se
  // qualcuno l'ha ridigitata, per definizione non e' ancora stata salvata.
  if (password.length > 0) {
    return true;
  }

  const salvati = campiDaImpostazioni(statoSalvato);

  return Object.keys(campi).some(
    (chiave) => confrontabile(campi[chiave]) !== confrontabile(salvati[chiave]),
  );
};
