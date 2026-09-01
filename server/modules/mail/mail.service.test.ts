import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:net';
import test from 'node:test';
import { isHttpError } from '../../core/errors.js';
import { buildMailService, salvaImpostazioniMailSchema } from './mail.service.js';
import type { ImpostazioniMailRecord, SalvaImpostazioniMailInput } from './mail.repository.js';

const RIGA_SALVATA: ImpostazioniMailRecord = {
  workspaceId: 'ws-1',
  attivo: true,
  server: 'mail.esempio.it',
  porta: 587,
  connessioneSicura: false,
  retePrivataConsentita: false,
  utente: 'noreply@esempio.it',
  mittente: 'Studio <noreply@esempio.it>',
  ciphertext: 'cifrata',
  iv: 'iv',
  authTag: 'tag',
  keyVersion: 1,
  updatedAt: new Date('2026-08-18T10:00:00.000Z'),
};

const CORPO_VALIDO = {
  attivo: true,
  server: 'mail.esempio.it',
  porta: 587,
  connessioneSicura: false,
  utente: 'noreply@esempio.it',
  mittente: 'Studio <noreply@esempio.it>',
};

/**
 * Un servizio con tutte le dipendenze finte, che registra l'ultimo `upsert`
 * ricevuto: e' li' che si legge la decisione sul segreto.
 */
const costruisciServizio = (riga: ImpostazioniMailRecord | null) => {
  const salvataggi: SalvaImpostazioniMailInput[] = [];

  const servizio = buildMailService({
    repository: {
      findByWorkspaceId: async () => riga,
      upsert: async (input) => {
        salvataggi.push(input);
        return { ...(riga ?? RIGA_SALVATA), ...input, updatedAt: new Date() } as ImpostazioniMailRecord;
      },
      deleteByWorkspaceId: async () => undefined,
    },
    crypto: {
      encrypt: async () => ({ ciphertext: 'nuova', iv: 'iv2', authTag: 'tag2', keyVersion: 1 }),
      decrypt: async () => 'segreto',
    },
    resolveSettings: async () => ({ esito: 'assente' as const }),
    leggiAmbiente: () => null,
    registraAudit: (async () => undefined) as never,
  });

  return { servizio, salvataggi };
};

test('la password lasciata vuota NON cancella quella gia\' salvata', async () => {
  const { servizio, salvataggi } = costruisciServizio(RIGA_SALVATA);

  await servizio.salvaImpostazioni({
    workspaceId: 'ws-1',
    actorUserId: 'user-1',
    // Chi cambia solo la porta non ridigita la password: il campo arriva vuoto.
    body: { ...CORPO_VALIDO, porta: 465, password: '' },
  });

  assert.equal(salvataggi.length, 1);
  assert.equal(salvataggi[0].porta, 465);
  // `undefined` = il repository non tocca le colonne del segreto.
  assert.equal(salvataggi[0].segreto, undefined);
});

test('una password nuova viene cifrata prima di arrivare al repository', async () => {
  const { servizio, salvataggi } = costruisciServizio(RIGA_SALVATA);

  await servizio.salvaImpostazioni({
    workspaceId: 'ws-1',
    actorUserId: 'user-1',
    body: { ...CORPO_VALIDO, password: 'una-password-vera' },
  });

  assert.deepEqual(salvataggi[0].segreto, {
    ciphertext: 'nuova',
    iv: 'iv2',
    authTag: 'tag2',
    keyVersion: 1,
  });
  // Il valore in chiaro non deve comparire da nessuna parte in cio' che si salva.
  assert.ok(!JSON.stringify(salvataggi[0]).includes('una-password-vera'));
});

test('password a null la rimuove', async () => {
  const { servizio, salvataggi } = costruisciServizio(RIGA_SALVATA);

  await servizio.salvaImpostazioni({
    workspaceId: 'ws-1',
    actorUserId: 'user-1',
    body: { ...CORPO_VALIDO, password: null },
  });

  assert.equal(salvataggi[0].segreto, null);
});

test('togliere l\'utente toglie anche la password rimasta a database', async () => {
  const { servizio, salvataggi } = costruisciServizio(RIGA_SALVATA);

  await servizio.salvaImpostazioni({
    workspaceId: 'ws-1',
    actorUserId: 'user-1',
    // Server senza autenticazione: senza utente la password non serve piu'.
    body: { ...CORPO_VALIDO, utente: '' },
  });

  assert.equal(salvataggi[0].utente, null);
  assert.equal(salvataggi[0].segreto, null);
});

test('la password non esce mai dalla lettura delle impostazioni', async () => {
  const { servizio } = costruisciServizio(RIGA_SALVATA);

  const impostazioni = await servizio.getImpostazioni('ws-1');

  assert.equal(impostazioni.passwordSalvata, true);
  assert.ok(!('password' in impostazioni));
  assert.ok(!JSON.stringify(impostazioni).includes('cifrata'));
});

test('senza riga a database la maschera si precompila con le variabili d\'ambiente', async () => {
  const { servizio } = buildMailServiceConAmbiente();

  const impostazioni = await servizio.getImpostazioni('ws-1');

  assert.equal(impostazioni.configurata, false);
  assert.equal(impostazioni.origineInUso, 'env');
  assert.equal(impostazioni.server, 'mail.ambiente.it');
  assert.equal(impostazioni.mittente, 'da-ambiente@esempio.it');
});

const buildMailServiceConAmbiente = () => {
  const servizio = buildMailService({
    repository: {
      findByWorkspaceId: async () => null,
      upsert: async () => RIGA_SALVATA,
      deleteByWorkspaceId: async () => undefined,
    },
    crypto: {
      encrypt: async () => ({ ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 }),
      decrypt: async () => null,
    },
    resolveSettings: async () => ({
      esito: 'ok' as const,
      source: 'env' as const,
      settings: {
        host: 'mail.ambiente.it',
        port: 25,
        secure: false,
        user: null,
        pass: null,
        from: 'da-ambiente@esempio.it',
      },
    }),
    leggiAmbiente: () => ({
      host: 'mail.ambiente.it',
      port: 25,
      secure: false,
      user: null,
      pass: null,
      from: 'da-ambiente@esempio.it',
    }),
    registraAudit: (async () => undefined) as never,
  });

  return { servizio };
};

test('un corpo senza mittente valido viene rifiutato con 400', async () => {
  const { servizio } = costruisciServizio(null);

  await assert.rejects(
    async () =>
      servizio.salvaImpostazioni({
        workspaceId: 'ws-1',
        actorUserId: 'user-1',
        body: { ...CORPO_VALIDO, mittente: 'non-e-un-indirizzo' },
      }),
    (error) => isHttpError(error) && error.statusCode === 400,
  );
});

test('il mittente accetta sia l\'indirizzo nudo sia il nome davanti', () => {
  for (const mittente of ['noreply@esempio.it', 'Studio Rossi <noreply@esempio.it>']) {
    const esito = salvaImpostazioniMailSchema.safeParse({ ...CORPO_VALIDO, mittente });
    assert.equal(esito.success, true, `rifiutato: ${mittente}`);
  }

  for (const mittente of ['noreply', 'noreply@', '<noreply@esempio.it', 'a b c']) {
    const esito = salvaImpostazioniMailSchema.safeParse({ ...CORPO_VALIDO, mittente });
    assert.equal(esito.success, false, `accettato per sbaglio: ${mittente}`);
  }
});

test('la porta accetta solo numeri di porta veri', () => {
  assert.equal(salvaImpostazioniMailSchema.safeParse({ ...CORPO_VALIDO, porta: 0 }).success, false);
  assert.equal(salvaImpostazioniMailSchema.safeParse({ ...CORPO_VALIDO, porta: 70000 }).success, false);
  assert.equal(salvaImpostazioniMailSchema.safeParse({ ...CORPO_VALIDO, porta: '465' }).success, true);
});

// La pagina "Server di posta" e' quella che serve a RIPARARE il guasto: se
// appiattisse "password non decifrabile" su "nessun server configurato",
// direbbe di configurare da capo una maschera gia' piena e giusta.
test('una configurazione illeggibile non viene spacciata per assente', async () => {
  const servizio = buildMailService({
    repository: {
      findByWorkspaceId: async () => RIGA_SALVATA,
      upsert: async () => RIGA_SALVATA,
      deleteByWorkspaceId: async () => undefined,
    },
    crypto: {
      encrypt: async () => ({ ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 }),
      decrypt: async () => null,
    },
    resolveSettings: async () => ({ esito: 'illeggibile' as const }),
    leggiAmbiente: () => null,
    registraAudit: (async () => undefined) as never,
  });

  const impostazioni = await servizio.getImpostazioni('ws-1');

  assert.equal(impostazioni.origineInUso, 'illeggibile');
  // I parametri restano a schermo: sono giusti, e' solo la password a non
  // essere piu' leggibile.
  assert.equal(impostazioni.configurata, true);
  assert.equal(impostazioni.server, 'mail.esempio.it');
});

test('la prova su una configurazione illeggibile lo dice, e non tocca la rete', async () => {
  const servizio = buildMailService({
    repository: {
      findByWorkspaceId: async () => RIGA_SALVATA,
      upsert: async () => RIGA_SALVATA,
      deleteByWorkspaceId: async () => undefined,
    },
    crypto: {
      encrypt: async () => ({ ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 }),
      decrypt: async () => null,
    },
    resolveSettings: async () => ({ esito: 'illeggibile' as const }),
    leggiAmbiente: () => null,
    registraAudit: (async () => undefined) as never,
  });

  const esito = await servizio.provaConnessione({ workspaceId: 'ws-1', actorUserId: 'user-1' });

  assert.equal(esito.riuscita, false);
  assert.equal(esito.origine, 'illeggibile');
  if (esito.riuscita) return;
  assert.match(esito.errore, /password/i);
});

test('la prova scrive nel registro attivita\' anche quando fallisce', async () => {
  const registrati: unknown[] = [];
  const servizio = buildMailService({
    repository: {
      findByWorkspaceId: async () => null,
      upsert: async () => RIGA_SALVATA,
      deleteByWorkspaceId: async () => undefined,
    },
    crypto: {
      encrypt: async () => ({ ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 }),
      decrypt: async () => null,
    },
    resolveSettings: async () => ({ esito: 'assente' as const }),
    leggiAmbiente: () => null,
    registraAudit: (async (input: unknown) => {
      registrati.push(input);
    }) as never,
  });

  await servizio.provaConnessione({ workspaceId: 'ws-1', actorUserId: 'user-1' });

  assert.equal(registrati.length, 1);
  assert.equal((registrati[0] as { event: string }).event, 'mail.test');
});

// ── L'autorizzazione a raggiungere la rete interna ────────────────────────────
// Il campo attraversa tre facce con lo stesso nome (colonna, corpo di PUT,
// risposta di GET): se una delle tre lo perde per strada, la maschera salva una
// spunta che al ricaricamento torna indietro senza dire niente.

test('l\'autorizzazione alla rete interna arriva fino al repository', async () => {
  const { servizio, salvataggi } = costruisciServizio(RIGA_SALVATA);

  await servizio.salvaImpostazioni({
    workspaceId: 'ws-1',
    actorUserId: 'user-1',
    body: { ...CORPO_VALIDO, retePrivataConsentita: true },
  });

  assert.equal(salvataggi[0].retePrivataConsentita, true);
});

test('un corpo che non nomina l\'autorizzazione la lascia spenta', () => {
  const parsed = salvaImpostazioniMailSchema.parse(CORPO_VALIDO);

  // `default(false)` e non `optional`: una maschera vecchia che non manda il
  // campo deve ricadere sul blocco, non lasciare passare la prova.
  assert.equal(parsed.retePrivataConsentita, false);
});

test('l\'autorizzazione si rilegge dalla riga salvata', async () => {
  const { servizio } = costruisciServizio({ ...RIGA_SALVATA, retePrivataConsentita: true });

  const impostazioni = await servizio.getImpostazioni('ws-1');

  assert.equal(impostazioni.retePrivataConsentita, true);
});

test('senza riga a database l\'autorizzazione risulta spenta', async () => {
  const { servizio } = buildMailServiceConAmbiente();

  const impostazioni = await servizio.getImpostazioni('ws-1');

  assert.equal(impostazioni.retePrivataConsentita, false);
});

test('accendere l\'autorizzazione resta scritto nel registro attivita\'', async () => {
  const registrati: Array<{ event: string; metadata?: Record<string, unknown> }> = [];
  const servizio = buildMailService({
    repository: {
      findByWorkspaceId: async () => RIGA_SALVATA,
      upsert: async () => RIGA_SALVATA,
      deleteByWorkspaceId: async () => undefined,
    },
    crypto: {
      encrypt: async () => ({ ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 }),
      decrypt: async () => 'segreto',
    },
    resolveSettings: async () => ({ esito: 'assente' as const }),
    leggiAmbiente: () => null,
    registraAudit: (async (input: never) => {
      registrati.push(input);
    }) as never,
  });

  await servizio.salvaImpostazioni({
    workspaceId: 'ws-1',
    actorUserId: 'user-1',
    body: { ...CORPO_VALIDO, retePrivataConsentita: true },
  });

  const salvataggio = registrati.find((riga) => riga.event === 'mail.save');
  assert.equal(salvataggio?.metadata?.retePrivataConsentita, true);
});

// ── La prova non deve diventare una sonda della rete interna (CRM-28) ─────────
// Chi ha `mail.manage` sceglie host e porta e legge cosa risponde: senza
// guardiano, il pulsante «Prova connessione» e' una scansione della rete
// dell'agenzia con un oracolo che risponde. Il blocco vale solo per la
// configurazione salvata nel CRM, che e' l'unica dove l'indirizzo lo sceglie chi
// preme il pulsante.

const AMBIENTE_VUOTO = {
  crypto: {
    encrypt: async () => ({ ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 }),
    decrypt: async () => 'segreto',
  },
  leggiAmbiente: () => null,
  registraAudit: (async () => undefined) as never,
};

/**
 * Un servizio la cui configurazione in uso arriva dall'origine indicata, con il
 * guardiano della rete privata sostituito da una spia: cosi' i casi si provano
 * senza un DNS vero davanti, e si puo' verificare CHE COSA gli e' stato chiesto.
 *
 * L'host e' sempre `127.0.0.1`, su una porta dove sta in ascolto `orecchio` (vedi
 * sotto): cosi' «non e' stata aperta nessuna connessione» si puo' DIMOSTRARE
 * contando gli arrivi, invece di dedurlo dal testo dell'esito.
 */
const servizioConGuardiano = (opzioni: {
  origine: 'database' | 'env';
  retePrivataConsentita?: boolean;
  privato: boolean;
  porta?: number;
}) => {
  const interrogazioni: string[] = [];
  const registrati: Array<{ event: string; metadata?: Record<string, unknown> }> = [];

  const servizio = buildMailService({
    ...AMBIENTE_VUOTO,
    repository: {
      // Non e' da qui che il guardiano legge l'autorizzazione: quella viaggia
      // insieme ai parametri, dentro `resolveSettings`. Questa riga serve solo
      // a chi legge le impostazioni.
      findByWorkspaceId: async () => ({ ...RIGA_SALVATA, server: '127.0.0.1' }),
      upsert: async () => RIGA_SALVATA,
      deleteByWorkspaceId: async () => undefined,
    },
    resolveSettings: async () => ({
      esito: 'ok' as const,
      source: opzioni.origine,
      retePrivataConsentita: opzioni.retePrivataConsentita ?? false,
      settings: {
        host: '127.0.0.1',
        port: opzioni.porta ?? 1,
        secure: false,
        user: null,
        pass: null,
        from: 'noreply@esempio.it',
      },
    }),
    hostDiRetePrivata: async (host: string) => {
      interrogazioni.push(host);
      return opzioni.privato;
    },
    registraAudit: (async (input: never) => {
      registrati.push(input);
    }) as never,
  });

  return { servizio, interrogazioni, registrati };
};

test('database + indirizzo privato + autorizzazione spenta: rifiutata senza aprire nulla', async () => {
  const { servizio, interrogazioni } = servizioConGuardiano({ origine: 'database', privato: true });

  const esito = await servizio.provaConnessione({ workspaceId: 'ws-1', actorUserId: 'user-1' });

  assert.equal(esito.riuscita, false);
  if (esito.riuscita) return;
  assert.equal(esito.motivo, 'rete_privata');
  assert.equal(esito.origine, 'database');
  // `server` resta valorizzato: senza, chi legge non sa quale indirizzo sia
  // stato rifiutato.
  assert.equal(esito.server, '127.0.0.1');
  assert.deepEqual(interrogazioni, ['127.0.0.1']);
  // Il messaggio non nomina l'interruttore della maschera (l'etichetta vive di
  // la', e tenerne due copie allineate a mano e' il difetto che si evita) e non
  // dice a quale IP l'indirizzo abbia risolto (sarebbe l'oracolo, in piccolo).
  assert.doesNotMatch(esito.errore, /\d+\.\d+\.\d+\.\d+/);
});

test('database + autorizzazione accesa: il guardiano non viene nemmeno interrogato', async () => {
  const { servizio, interrogazioni } = servizioConGuardiano({
    origine: 'database',
    retePrivataConsentita: true,
    privato: true,
  });

  const esito = await servizio.provaConnessione({ workspaceId: 'ws-1', actorUserId: 'user-1' });

  assert.deepEqual(interrogazioni, []);
  assert.equal(esito.riuscita, false);
  if (esito.riuscita) return;
  // Fallisce perche' dall'altra parte non risponde nessuno, NON perche' l'abbiamo
  // fermata noi: e' la differenza che `motivo` esiste per dire.
  assert.equal(esito.motivo, undefined);
});

test('parametri dal file .env: il blocco non si applica', async () => {
  const { servizio, interrogazioni } = servizioConGuardiano({ origine: 'env', privato: true });

  const esito = await servizio.provaConnessione({ workspaceId: 'ws-1', actorUserId: 'user-1' });

  // Con il `.env` l'indirizzo lo ha scritto chi amministra il server, non chi
  // preme il pulsante: non c'e' nessuna sonda da chiudere, e bloccare lascerebbe
  // l'agenzia con la prova ferma e nessuna casella da spuntare.
  assert.deepEqual(interrogazioni, []);
  assert.equal(esito.riuscita, false);
  if (esito.riuscita) return;
  assert.equal(esito.motivo, undefined);
});

test('database + indirizzo pubblico: la prova prosegue come prima', async () => {
  // L'orecchio saluta con un `421`: la prova fallisce per come ha risposto il
  // server, non per un rifiuto nostro, e il messaggio di nodemailer non nomina
  // nessun indirizzo.
  await conOrecchio(async (porta, arrivi) => {
    const { servizio, interrogazioni } = servizioConGuardiano({
      origine: 'database',
      privato: false,
      porta,
    });

    const esito = await servizio.provaConnessione({ workspaceId: 'ws-1', actorUserId: 'user-1' });

    assert.deepEqual(interrogazioni, ['127.0.0.1']);
    assert.equal(arrivi(), 1);
    assert.equal(esito.riuscita, false);
    if (esito.riuscita) return;
    assert.equal(esito.motivo, undefined);
    // Il messaggio vero del server arriva intero: e' il motivo per cui il
    // pulsante esiste.
    assert.match(esito.errore, /421/);
  });
});

test('se la connessione finisce su un indirizzo interno, il messaggio non lo riporta', async () => {
  // Il guardiano ha detto "pubblico" e la connessione e' finita su
  // `127.0.0.1` lo stesso: e' la forma che prende un DNS che risponde due volte
  // in modo diverso. Il messaggio di nodemailer sarebbe
  // «connect ECONNREFUSED 127.0.0.1:1», cioe' l'indirizzo interno servito a chi
  // stava sondando.
  const { servizio, registrati } = servizioConGuardiano({ origine: 'database', privato: false });

  const esito = await servizio.provaConnessione({ workspaceId: 'ws-1', actorUserId: 'user-1' });

  assert.equal(esito.riuscita, false);
  if (esito.riuscita) return;
  assert.equal(esito.motivo, 'rete_privata');
  assert.doesNotMatch(esito.errore, /127\.0\.0\.1/);
  assert.equal(registrati.find((riga) => riga.event === 'mail.test')?.metadata?.motivo, 'rete_privata');
});

test('chi ha autorizzato la rete interna riceve il messaggio vero, indirizzo compreso', async () => {
  // Il filtro dell'ultimo momento non si applica a chi ha dichiarato di avere il
  // server dentro la propria rete: a quel punto «connect ECONNREFUSED
  // 127.0.0.1:1» e' l'informazione che serve per rimediare, non una fuga.
  const { servizio } = servizioConGuardiano({
    origine: 'database',
    retePrivataConsentita: true,
    privato: true,
  });

  const esito = await servizio.provaConnessione({ workspaceId: 'ws-1', actorUserId: 'user-1' });

  assert.equal(esito.riuscita, false);
  if (esito.riuscita) return;
  assert.equal(esito.motivo, undefined);
  assert.match(esito.errore, /127\.0\.0\.1/);
});

test('il rifiuto per rete privata resta scritto nel registro attivita\'', async () => {
  const { servizio, registrati } = servizioConGuardiano({ origine: 'database', privato: true });

  await servizio.provaConnessione({ workspaceId: 'ws-1', actorUserId: 'user-1' });

  const prova = registrati.find((riga) => riga.event === 'mail.test');
  assert.equal(prova?.metadata?.riuscita, false);
  assert.equal(prova?.metadata?.origine, 'database');
  assert.equal(prova?.metadata?.server, '127.0.0.1');
  // Senza `motivo`, nel registro un rifiuto nostro e un rifiuto del server vero
  // sono due righe identiche.
  assert.equal(prova?.metadata?.motivo, 'rete_privata');
});

/**
 * Un orecchio in ascolto su `127.0.0.1`, che conta chi bussa e chiude subito.
 *
 * E' quello che trasforma «nessuna connessione e' stata aperta» da promessa
 * scritta nel messaggio d'errore a fatto verificabile: e' il cuore di CRM-28, e
 * un guardiano che rispondesse la frase giusta DOPO aver aperto la connessione
 * passerebbe tutti gli altri test di questo file.
 */
const conOrecchio = async (prova: (porta: number, arrivi: () => number) => Promise<void>) => {
  let arrivi = 0;
  const server: Server = createServer((socket) => {
    arrivi += 1;
    // Un saluto SMTP negativo e poi si chiude: nodemailer rinuncia all'istante e
    // libera i suoi tempi d'attesa. Con un `destroy()` secco la connessione
    // muore da stabilita, i timer da dieci secondi restano appesi, e il file di
    // test impiega undici secondi invece di uno.
    socket.end('421 chiuso\r\n');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const indirizzo = server.address();
  if (typeof indirizzo === 'string' || indirizzo === null) throw new Error('porta non assegnata');

  try {
    await prova(indirizzo.port, () => arrivi);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

test('il rifiuto per rete privata non fa arrivare NIENTE dall\'altra parte', async () => {
  await conOrecchio(async (porta, arrivi) => {
    const { servizio } = servizioConGuardiano({ origine: 'database', privato: true, porta });

    const esito = await servizio.provaConnessione({ workspaceId: 'ws-1', actorUserId: 'user-1' });

    assert.equal(esito.riuscita, false);
    assert.equal(arrivi(), 0);
  });
});

test('con l\'autorizzazione accesa la connessione viene aperta davvero', async () => {
  await conOrecchio(async (porta, arrivi) => {
    const { servizio } = servizioConGuardiano({
      origine: 'database',
      retePrivataConsentita: true,
      privato: true,
      porta,
    });

    // Il contro-caso del test qui sopra: senza, «zero arrivi» sarebbe vero anche
    // se la prova non provasse piu' niente per nessuno.
    await servizio.provaConnessione({ workspaceId: 'ws-1', actorUserId: 'user-1' });

    assert.equal(arrivi(), 1);
  });
});
