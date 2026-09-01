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
 * La riga di aiuto sotto l'interruttore. Delimita il campo d'azione: il blocco
 * ha un solo punto di applicazione nel backend, dentro `provaConnessione`, e
 * non tocca l'invio delle email.
 */
export const AIUTO_RETE_INTERNA =
  'Riguarda solo la «Prova connessione»: spento, la prova rifiuta gli indirizzi della rete interna senza aprire nessuna connessione. La spedizione delle email non cambia.';

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
