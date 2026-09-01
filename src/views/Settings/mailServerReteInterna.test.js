// Il rimando all'interruttore attaccato all'esito della prova.
//
// La cosa da non sbagliare e' il PERIMETRO: la frase deve comparire solo per il
// rifiuto della rete interna. Su una password illeggibile o su un server che
// rifiuta davvero le credenziali, «spunta la casella e salva» manderebbe chi
// legge a cercare la causa nel posto sbagliato.
import { describe, it, expect } from 'vitest';
import {
  aiutoReteInterna,
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
    for (const origine of ['database', 'env', 'nessuna', 'illeggibile', undefined]) {
      expect(aiutoReteInterna(origine)).toMatch(/Prova connessione/);
      expect(aiutoReteInterna(origine)).toMatch(/spedizione delle email non cambia/i);
    }
  });
});

describe('aiutoReteInterna', () => {
  // ⚠️ Il cuore del rilievo: il filtro del backend esige
  // `source === 'database'` (mail.net-guard.ts), quindi la riga di aiuto puo'
  // promettere il rifiuto SOLO quando il CRM sta usando la configurazione
  // salvata qui. Altrove prometterebbe una protezione che non gira.
  it('con la configurazione salvata in uso promette il rifiuto senza connessione', () => {
    expect(aiutoReteInterna('database')).toMatch(
      /senza aprire nessuna connessione/i,
    );
  });

  it('sul ramo .env dice che la prova non filtra niente', () => {
    const aiuto = aiutoReteInterna('env');

    expect(aiuto).toMatch(/non filtra nessun indirizzo/i);
    // E soprattutto NON deve promettere il blocco: e' la frase che il revisore
    // ha fermato il 1/9/2026.
    expect(aiuto).not.toMatch(/senza aprire nessuna connessione/i);
  });

  it('dice la stessa cosa quando non c\'e\' configurazione o la password non si legge', () => {
    // Tre origini diverse, un solo fatto: il filtro non gira. La frase non
    // nomina il `.env` proprio per restare vera in tutti e tre i casi (e nella
    // configurazione salvata ma in pausa, che torna origine `env`/`nessuna`).
    for (const origine of ['nessuna', 'illeggibile', undefined, null]) {
      expect(aiutoReteInterna(origine)).toBe(aiutoReteInterna('env'));
    }
  });

  it('dice che l\'interruttore vale da quando la configurazione e\' quella in uso', () => {
    // Il raccordo col fatto n. 1 del compito: senza, chi spunta la casella su
    // un CRM che spedisce col `.env` non sa cosa gli manchi.
    expect(aiutoReteInterna('env')).toMatch(/da quando questa configurazione è quella in uso/i);
  });
});
