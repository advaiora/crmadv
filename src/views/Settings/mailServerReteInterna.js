// L'interruttore che autorizza la «Prova connessione» verso la rete interna.
//
// Perche' e' un file a parte e non due stringhe dentro il JSX. Le stesse parole
// servono in due punti lontani della maschera: l'etichetta dell'interruttore, e
// la frase che si aggiunge all'esito quando la prova e' stata rifiutata proprio
// per quel motivo. Il backend non le scrive apposta — «l'etichetta vive nella
// maschera e scriverla anche qui vorrebbe dire tenerne due copie allineate a
// mano» (server/modules/mail/mail.service.ts) — quindi la copia unica sta qui.
//
// Da dove viene l'etichetta. Il compito vietava di inventarla: la decide il
// consiglio (regola ② di CLAUDE.md). Sull'interazione `bd9cd3aa` di CRM-26,
// risolta l'1/9/2026, alla terza domanda il consiglio non ha scelto fra le tre
// proposte e ha risposto «ti autorizzo a scegliere in autonomia la cosa che
// ritieni piu opportuna». Fra le tre, questa e' l'unica che descrive la
// SITUAZIONE invece dell'eccezione tecnica: chi la spunta sa se e' vera senza
// dover sapere cosa sia un indirizzo di rete privata. Le altre due
// («Consenti indirizzi di rete interna», «Autorizza la prova verso indirizzi
// privati») chiedono a chi legge di conoscere il gergo di rete.

/** L'etichetta dell'interruttore. Citata anche dall'esito di una prova rifiutata. */
export const ETICHETTA_RETE_INTERNA = "Il server di posta è nella rete interna dell'agenzia";

/**
 * La riga di aiuto quando il filtro c'e' davvero, cioe' quando il CRM sta
 * usando la configurazione salvata qui. Delimita il campo d'azione: il blocco
 * ha un solo punto di applicazione nel backend, dentro `provaConnessione`, e
 * non tocca l'invio delle email.
 */
const AIUTO_FILTRO_ATTIVO =
  'Riguarda solo la «Prova connessione»: spento, la prova rifiuta gli indirizzi della rete interna senza aprire nessuna connessione. La spedizione delle email non cambia.';

/**
 * La riga di aiuto quando il filtro NON gira, e va detto invece di lasciar
 * credere il contrario.
 *
 * ⚠️ Il filtro del backend e' condizionato alla provenienza dei parametri:
 * `richiedeControlloRetePrivata` (server/modules/mail/mail.net-guard.ts) esige
 * `source === 'database'`, e non per un capriccio — il ramo del database e'
 * l'unico in cui l'host lo ha scritto chi preme il pulsante. Con i parametri
 * del file `.env`, senza nessuna configurazione, o con la password illeggibile,
 * la prova si collega comunque. Promettere qui una protezione che non gira
 * sarebbe la stessa bugia silenziosa di `posta.gestisci` del 18/8: nessun
 * errore, invisibile, e la si scopre solo quando qualcuno ci fa affidamento.
 *
 * La frase non nomina il `.env` di proposito: copre anche «nessuna
 * configurazione», «password illeggibile» e la configurazione salvata ma in
 * pausa, dove nominarlo sarebbe falso. Quale sia l'origine in uso lo dice gia',
 * per esteso, la fascia in cima alla pagina (`descriviOrigine`).
 */
const AIUTO_FILTRO_INERTE =
  "Riguarda solo la «Prova connessione», e solo quando il CRM sta usando la configurazione salvata qui. Adesso non è così, quindi la prova non filtra nessun indirizzo: l'interruttore vale da quando questa configurazione è quella in uso. La spedizione delle email non cambia.";

/**
 * La riga di aiuto sotto l'interruttore, scelta in base a cosa il CRM sta
 * usando adesso per spedire.
 *
 * `origineInUso` e' il predicato giusto e non un'approssimazione: il backend lo
 * ricava dalla STESSA `resolveSettings` che poi decide se applicare il filtro
 * (`mail.service.ts`, `getImpostazioni` e `provaConnessione`), quindi
 * `'database'` qui e filtro attivo la' sono la medesima condizione. Vale anche
 * per la configurazione in pausa: con `attivo` spento la lettura torna
 * `assente`, l'origine diventa `'env'` o `'nessuna'`, e infatti il filtro non
 * gira.
 */
export const aiutoReteInterna = (origineInUso) =>
  origineInUso === 'database' ? AIUTO_FILTRO_ATTIVO : AIUTO_FILTRO_INERTE;

/**
 * La frase da aggiungere all'esito della prova quando il rifiuto viene dal
 * blocco della rete interna — e solo allora.
 *
 * Il messaggio del server dice cosa e' successo ma non come rimediare, ed e'
 * giusto cosi': non conosce ne' l'etichetta ne' il fatto che la prova legga la
 * configurazione salvata. Sono esattamente le due cose che chi legge deve
 * sapere per non concludere «l'autorizzazione non funziona» dopo aver spuntato
 * la casella e premuto subito il pulsante.
 *
 * `motivo` arriva valorizzato SOLO per questo rifiuto (mail.service.ts): la
 * password illeggibile, la configurazione assente e il rifiuto del server vero
 * non lo portano, quindi qui non entrano.
 */
export const rimandoAllInterruttore = (esito) => {
  if (esito?.motivo !== 'rete_privata') {
    return '';
  }

  return ` Se è il server di posta dell'agenzia, spunta «${ETICHETTA_RETE_INTERNA}» qui sotto e salva: la prova collauda la configurazione salvata.`;
};
