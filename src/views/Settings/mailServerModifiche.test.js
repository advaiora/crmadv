// Il confronto fra la maschera «Server di posta» e la configurazione salvata.
//
// Il caso che conta e' quello del §7.7 punto 9: si corregge la porta, si preme
// «Prova connessione» senza salvare, e il server prova comunque la porta
// vecchia. Qui si verifica che quella situazione venga riconosciuta — e che
// venga riconosciuta SENZA che nessuno abbia elencato i campi per nome, cosi'
// il giorno in cui la maschera cresce non serve tornare qui.
import { describe, it, expect } from 'vitest';
import {
  CAMPI_VUOTI,
  campiDaImpostazioni,
  ciSonoModifichePendenti,
} from './mailServerModifiche';

const SALVATO = {
  configurata: true,
  origineInUso: 'database',
  passwordSalvata: true,
  attivo: true,
  server: 'mail.esempio.it',
  porta: 587,
  connessioneSicura: false,
  utente: 'noreply@esempio.it',
  mittente: 'Studio <noreply@esempio.it>',
  aggiornatoIl: '2026-08-18T10:00:00.000Z',
};

const maschera = (modifiche = {}) => ({ ...campiDaImpostazioni(SALVATO), ...modifiche });

describe('campiDaImpostazioni', () => {
  it('senza niente di salvato torna i valori con cui nasce la maschera', () => {
    expect(campiDaImpostazioni(undefined)).toEqual(CAMPI_VUOTI);
  });

  it('un utente assente diventa campo vuoto, ma un interruttore spento resta spento', () => {
    const campi = campiDaImpostazioni({ ...SALVATO, utente: null, attivo: false });

    expect(campi.utente).toBe('');
    expect(campi.attivo).toBe(false);
  });

  it('copre esattamente i campi della maschera, ne uno di piu\' ne uno di meno', () => {
    // Se questo test diventa rosso, e' perche' qualcuno ha aggiunto un campo a
    // CAMPI_VUOTI: e' il segnale che il campo nuovo e' entrato da solo nel
    // confronto, che e' esattamente cio' che si voleva.
    expect(Object.keys(campiDaImpostazioni(SALVATO)).sort()).toEqual(
      Object.keys(CAMPI_VUOTI).sort(),
    );
  });
});

describe('ciSonoModifichePendenti', () => {
  it('appena caricata la pagina non segnala niente', () => {
    expect(
      ciSonoModifichePendenti({ campi: maschera(), statoSalvato: SALVATO, password: '' }),
    ).toBe(false);
  });

  it('riconosce la porta corretta e non ancora salvata', () => {
    expect(
      ciSonoModifichePendenti({
        campi: maschera({ porta: '465' }),
        statoSalvato: SALVATO,
        password: '',
      }),
    ).toBe(true);
  });

  it('la stessa porta ridigitata a mano non e\' una modifica', () => {
    // Il campo numerico restituisce una stringa, il server un numero: senza
    // normalizzare, riscrivere "587" accenderebbe l'avviso a vuoto.
    expect(
      ciSonoModifichePendenti({
        campi: maschera({ porta: '587' }),
        statoSalvato: SALVATO,
        password: '',
      }),
    ).toBe(false);
  });

  it('uno spazio in coda a un campo di testo non e\' una modifica', () => {
    expect(
      ciSonoModifichePendenti({
        campi: maschera({ server: 'mail.esempio.it ' }),
        statoSalvato: SALVATO,
        password: '',
      }),
    ).toBe(false);
  });

  it('riconosce anche un interruttore mosso, non solo i campi di testo', () => {
    // «Usa questo server per spedire» era gia' fuori da qualunque elenco fatto
    // per nome: e' la prova pratica che il confronto deve essere generico.
    expect(
      ciSonoModifichePendenti({
        campi: maschera({ attivo: false }),
        statoSalvato: SALVATO,
        password: '',
      }),
    ).toBe(true);

    expect(
      ciSonoModifichePendenti({
        campi: maschera({ connessioneSicura: true }),
        statoSalvato: SALVATO,
        password: '',
      }),
    ).toBe(true);
  });

  it('riconosce un campo che oggi non esiste ancora nella maschera', () => {
    // Simula il campo che arrivera' con l'interruttore della rete interna: il
    // confronto lo deve vedere perche' e' fra le chiavi della maschera, non
    // perche' qualcuno lo ha aggiunto qui.
    const campi = { ...maschera(), retePrivataConsentita: true };
    const statoSalvato = { ...SALVATO, retePrivataConsentita: false };

    expect(ciSonoModifichePendenti({ campi, statoSalvato, password: '' })).toBe(true);
  });

  it('una password ridigitata e\' sempre una modifica pendente', () => {
    // La password non torna mai dal server: non c'e' niente con cui
    // confrontarla, quindi se qualcuno l'ha scritta non e' ancora salvata.
    expect(
      ciSonoModifichePendenti({
        campi: maschera(),
        statoSalvato: SALVATO,
        password: 'nuova',
      }),
    ).toBe(true);
  });

  it('senza niente di salvato non segnala niente, nemmeno con la maschera piena', () => {
    // Quel caso ha gia' il suo avviso e il pulsante spento: non c'e' nessuna
    // configurazione vecchia da scambiare per quella nuova.
    const statoSalvato = { ...SALVATO, configurata: false };

    expect(
      ciSonoModifichePendenti({
        campi: maschera({ server: 'altro.esempio.it' }),
        statoSalvato,
        password: 'nuova',
      }),
    ).toBe(false);

    expect(
      ciSonoModifichePendenti({ campi: maschera(), statoSalvato: null, password: '' }),
    ).toBe(false);
  });
});
