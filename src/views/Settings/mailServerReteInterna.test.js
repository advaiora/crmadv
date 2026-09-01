// Il rimando all'interruttore attaccato all'esito della prova.
//
// La cosa da non sbagliare e' il PERIMETRO: la frase deve comparire solo per il
// rifiuto della rete interna. Su una password illeggibile o su un server che
// rifiuta davvero le credenziali, «spunta la casella e salva» manderebbe chi
// legge a cercare la causa nel posto sbagliato.
import { describe, it, expect } from 'vitest';
import {
  AIUTO_RETE_INTERNA,
  ETICHETTA_RETE_INTERNA,
  rimandoAllInterruttore,
} from './mailServerReteInterna';

describe('rimandoAllInterruttore', () => {
  it('sul rifiuto della rete interna cita l\'etichetta, parola per parola', () => {
    const frase = rimandoAllInterruttore({
      riuscita: false,
      motivo: 'rete_privata',
      server: 'mail.interno.lan',
      errore: "L'indirizzo del server di posta è dentro una rete privata.",
    });

    expect(frase).toContain(ETICHETTA_RETE_INTERNA);
  });

  it('dice anche che vale da quando e\' salvato', () => {
    // Senza questa mezza frase, chi spunta la casella e preme subito il
    // pulsante rilegge «bloccato» e conclude che l'autorizzazione non funzioni.
    expect(rimandoAllInterruttore({ motivo: 'rete_privata' })).toMatch(
      /configurazione salvata/i,
    );
  });

  it('su ogni altro fallimento non dice niente', () => {
    // `motivo` arriva valorizzato solo per il rifiuto della rete privata: sono
    // i tre casi che il backend lascia senza.
    expect(
      rimandoAllInterruttore({ riuscita: false, errore: 'Password illeggibile.' }),
    ).toBe('');
    expect(
      rimandoAllInterruttore({ riuscita: false, errore: 'Nessun server di posta configurato.' }),
    ).toBe('');
    expect(
      rimandoAllInterruttore({ riuscita: false, errore: 'connect ECONNREFUSED' }),
    ).toBe('');
  });

  it('su una prova riuscita non dice niente', () => {
    expect(rimandoAllInterruttore({ riuscita: true, server: 'mail.esempio.it' })).toBe('');
  });

  it('non esplode se l\'esito manca del tutto', () => {
    expect(rimandoAllInterruttore(null)).toBe('');
    expect(rimandoAllInterruttore(undefined)).toBe('');
  });

  it('la frase attaccata comincia con uno spazio', () => {
    // Viene concatenata in coda al messaggio del server dentro lo stesso
    // template: senza lo spazio le due frasi si incollerebbero.
    expect(rimandoAllInterruttore({ motivo: 'rete_privata' })).toMatch(/^ \S/);
  });
});

describe('i testi dell\'interruttore', () => {
  it('l\'etichetta e\' quella scelta sull\'interazione di CRM-26', () => {
    expect(ETICHETTA_RETE_INTERNA).toBe(
      "Il server di posta è nella rete interna dell'agenzia",
    );
  });

  it('l\'aiuto delimita il campo d\'azione: solo la prova, non la spedizione', () => {
    // Il blocco ha un solo punto di applicazione nel backend, dentro
    // `provaConnessione`. Se un domani coprisse anche l'invio, questo test
    // cade ed e' giusto che cada: la riga a schermo starebbe mentendo.
    expect(AIUTO_RETE_INTERNA).toMatch(/Prova connessione/);
    expect(AIUTO_RETE_INTERNA).toMatch(/spedizione delle email non cambia/i);
  });
});
