import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPasswordResetService } from './password-reset.service.js';

// Le prove del recupero password. La piu' importante di tutte e' la prima:
// l'indirizzo che non esiste deve produrre la STESSA risposta di quello che
// esiste, altrimenti il recupero password diventa un modo per sapere chi ha un
// account nel CRM.
//
// Niente database, niente bcrypt vero, niente server di posta: tutto iniettato.

const NOW = new Date('2026-09-09T10:00:00.000Z');

type Registrato = {
  event: string;
  workspaceId: string;
  reason?: string;
};

const creaServizio = (override: {
  utente?: { id: string } | null;
  tokenRow?: {
    id: string;
    userId: string;
    expiresAt: Date;
    usedAt: Date | null;
  } | null;
  markUsedTorna?: boolean;
  workspaceId?: string | null;
  baseUrl?: string | null;
  conteggioPerIp?: number;
  emailConsegnata?: boolean;
  aspettaConsegna?: boolean;
  onSend?: () => Promise<void>;
} = {}) => {
  const emailInviate: Array<{ toEmail: string; resetLink: string; workspaceId?: string }> = [];
  const righeCreate: Array<{ userId: string; tokenHash: string; expiresAt: Date; requestIp: string | null }> = [];
  const bruciature: Array<{ userId: string }> = [];
  const passwordScritte: Array<{ userId: string; passwordHash: string; passwordChangedAt: Date }> = [];
  const registro: Registrato[] = [];

  const servizio = buildPasswordResetService({
    userRepositoryApi: {
      findByEmail: async () =>
        (override.utente === undefined ? { id: 'utente-1' } : override.utente) as never,
      updatePasswordHash: async (
        userId: string,
        passwordHash: string,
        passwordChangedAt: Date,
      ) => {
        passwordScritte.push({ userId, passwordHash, passwordChangedAt });
        return undefined as never;
      },
    } as never,
    membershipRepositoryApi: {
      findPrimaryWorkspaceId: async () =>
        override.workspaceId === undefined ? 'workspace-1' : override.workspaceId,
    } as never,
    resetRepositoryApi: {
      create: async (input: never) => {
        righeCreate.push(input);
        return undefined as never;
      },
      findByTokenHash: async () => (override.tokenRow ?? null) as never,
      markUsed: async () => override.markUsedTorna ?? true,
      invalidateOutstanding: async (input: { userId: string }) => {
        bruciature.push({ userId: input.userId });
        return { count: 0 } as never;
      },
      countRecentByIp: async () => override.conteggioPerIp ?? 0,
    } as never,
    notifierApi: {
      sendResetLink: async (input: never) => {
        await override.onSend?.();
        emailInviate.push(input);
        return override.emailConsegnata === false
          ? { delivered: false as const, reason: 'MAIL_NOT_CONFIGURED' as const }
          : { delivered: true as const, providerMessageId: 'msg-1' };
      },
    } as never,
    hashPasswordFn: async (password: string) => `hash(${password})`,
    generateTokenFn: () => 'token-in-chiaro',
    // ⚠️ Impronta finta OPACA, che non contiene il token in chiaro. Una finta
    // del tipo `impronta(${token})` sembrerebbe piu' leggibile, ma renderebbe
    // impossibile la prova qui sotto — «il valore in chiaro non compare nella
    // riga salvata» risulterebbe falsa per colpa della finta, non del codice.
    hashTokenFn: () => 'IMPRONTA-OPACA',
    auditLogFn: (async (input: {
      event?: string;
      workspaceId: string;
      metadata?: { reason?: string };
    }) => {
      registro.push({
        event: input.event ?? '(senza nome)',
        workspaceId: input.workspaceId,
        ...(input.metadata?.reason ? { reason: input.metadata.reason } : {}),
      });
    }) as never,
    resolveBaseUrlFn: () =>
      override.baseUrl === undefined ? 'https://crm.esempio.it' : override.baseUrl,
    // ⚠️ Vero per difetto nelle prove, e NON perche' sia il comportamento di
    // produzione — in produzione e' falso apposta. E' che con `false` la
    // consegna parte senza essere aspettata, e un test che controlla subito
    // dopo troverebbe la finta email non ancora spedita: misurerebbe la corsa,
    // non il codice. La prova del ramo di produzione e' scritta a parte, e
    // aspetta esplicitamente.
    shouldAwaitDeliveryFn: () => override.aspettaConsegna ?? true,
    // Il vero `$transaction` vuole un database. Qui si esegue e basta: le prove
    // sull'ordine delle scritture non hanno bisogno del rollback vero, e cio'
    // che conta — che `markUsed` possa dire «ho perso la corsa» — si prova
    // facendogli restituire `false`.
    runInTransactionFn: (async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({} as never)) as never,
    nowFn: () => NOW,
  });

  return { servizio, emailInviate, righeCreate, bruciature, passwordScritte, registro };
};

// --- La richiesta del link -------------------------------------------------

test('un indirizzo che non esiste riceve la stessa risposta di uno che esiste', async () => {
  const sconosciuto = creaServizio({ utente: null });
  const conosciuto = creaServizio();

  const rispostaSconosciuto = await sconosciuto.servizio.requestReset({
    body: { email: 'nessuno@esempio.it' },
    requestIp: '10.0.0.1',
  });
  const rispostaConosciuto = await conosciuto.servizio.requestReset({
    body: { email: 'utente@esempio.it' },
    requestIp: '10.0.0.1',
  });

  assert.deepEqual(rispostaSconosciuto, rispostaConosciuto);
  // E soprattutto: per l'indirizzo sconosciuto non e' partito niente e non e'
  // stata scritta nessuna riga. La risposta e' uguale, il lavoro no.
  assert.deepEqual(sconosciuto.emailInviate, []);
  assert.deepEqual(sconosciuto.righeCreate, []);
});

test('la richiesta salva solo l impronta del token, mai il valore in chiaro', async () => {
  const { servizio, righeCreate, emailInviate } = creaServizio();

  await servizio.requestReset({
    body: { email: 'utente@esempio.it' },
    requestIp: '10.0.0.1',
  });

  assert.equal(righeCreate.length, 1);
  assert.equal(righeCreate[0].tokenHash, 'IMPRONTA-OPACA');
  // Il valore in chiaro non deve comparire da nessuna parte della riga salvata.
  assert.equal(JSON.stringify(righeCreate[0]).includes('token-in-chiaro'), false);
  // Ma nel link dell'email si', altrimenti non servirebbe a niente.
  assert.equal(
    emailInviate[0].resetLink,
    'https://crm.esempio.it/reset-password?token=token-in-chiaro',
  );
});

test('la richiesta brucia i link chiesti prima, cosi non ne restano due buoni insieme', async () => {
  const { servizio, bruciature } = creaServizio();

  await servizio.requestReset({
    body: { email: 'utente@esempio.it' },
    requestIp: '10.0.0.1',
  });

  assert.deepEqual(bruciature, [{ userId: 'utente-1' }]);
});

test('il token scade a 30 minuti dal momento della richiesta', async () => {
  const { servizio, righeCreate } = creaServizio();

  await servizio.requestReset({
    body: { email: 'utente@esempio.it' },
    requestIp: '10.0.0.1',
  });

  assert.equal(
    righeCreate[0].expiresAt.getTime() - NOW.getTime(),
    30 * 60 * 1000,
  );
});

test('superato il tetto per indirizzo IP non parte niente, ma la risposta non cambia', async () => {
  const { servizio, emailInviate, righeCreate } = creaServizio({ conteggioPerIp: 99 });

  const risposta = await servizio.requestReset({
    body: { email: 'utente@esempio.it' },
    requestIp: '10.0.0.1',
  });

  assert.deepEqual(risposta, { requested: true, previewUrl: null });
  assert.deepEqual(emailInviate, []);
  assert.deepEqual(righeCreate, []);
});

test('senza indirizzo pubblico configurato non si inventa un link: lo si registra', async () => {
  const { servizio, emailInviate, registro } = creaServizio({ baseUrl: null });

  const risposta = await servizio.requestReset({
    body: { email: 'utente@esempio.it' },
    requestIp: '10.0.0.1',
  });

  assert.equal(risposta.requested, true);
  assert.deepEqual(emailInviate, []);
  assert.equal(registro[0].reason, 'base_url_not_configured');
});

test('la posta non configurata finisce nel registro, non in un errore', async () => {
  const { servizio, registro } = creaServizio({ emailConsegnata: false });

  const risposta = await servizio.requestReset({
    body: { email: 'utente@esempio.it' },
    requestIp: '10.0.0.1',
  });

  assert.equal(risposta.requested, true);
  assert.equal(registro[0].reason, 'MAIL_NOT_CONFIGURED');
});

test('un utente senza workspace non fa fallire la richiesta, salta solo il registro', async () => {
  const { servizio, registro, emailInviate } = creaServizio({ workspaceId: null });

  const risposta = await servizio.requestReset({
    body: { email: 'utente@esempio.it' },
    requestIp: '10.0.0.1',
  });

  assert.equal(risposta.requested, true);
  assert.equal(emailInviate.length, 1);
  assert.deepEqual(registro, []);
});

// ⚠️ La prova che chiude l'oracolo dei tempi. Un corpo di risposta identico non
// basta: se il ramo «utente trovato» aspettasse la consegna dell'email, chi
// cronometra vedrebbe gli indirizzi registrati impiegare secondi e gli altri
// millisecondi, e saprebbe di nuovo chi ha un account nel CRM.
test('in produzione la risposta non aspetta la consegna dell email', async () => {
  // Uno spedizioniere che non torna finche' non lo si scioglie a mano: e'
  // l'unico modo per distinguere «non aspettata» da «solo veloce».
  let sciogliConsegna: () => void = () => {};
  const consegnaAppesa = new Promise<void>((resolve) => {
    sciogliConsegna = resolve;
  });

  const { servizio, emailInviate } = creaServizio({
    aspettaConsegna: false,
    onSend: async () => {
      await consegnaAppesa;
    },
  });

  // ⚠️ Corsa contro un timer invece di un semplice `await`: se il codice
  // tornasse ad aspettare la consegna, un `await` nudo resterebbe appeso per
  // sempre e la prova morirebbe di timeout — un rosso che sembra un guasto
  // dell'ambiente (nota operativa #37) invece del difetto che e'. Cosi' invece
  // fallisce dicendo esattamente cosa e' successo.
  const esito = await Promise.race([
    servizio
      .requestReset({ body: { email: 'utente@esempio.it' }, requestIp: '10.0.0.1' })
      .then((risposta) => ({ tipo: 'risposta' as const, risposta })),
    new Promise<{ tipo: 'appesa' }>((resolve) => {
      setTimeout(() => { resolve({ tipo: 'appesa' }); }, 250);
    }),
  ]);

  assert.equal(
    esito.tipo,
    'risposta',
    'la risposta ha aspettato la consegna dell email: l oracolo dei tempi e riaperto',
  );
  assert.deepEqual(
    esito.tipo === 'risposta' ? esito.risposta : null,
    { requested: true, previewUrl: null },
  );
  assert.deepEqual(emailInviate, []);

  // Ma l'email parte lo stesso, dopo.
  sciogliConsegna();
  await consegnaAppesa;
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(emailInviate.length, 1);
});

test('un indirizzo email malformato viene rifiutato', async () => {
  const { servizio } = creaServizio();

  await assert.rejects(
    servizio.requestReset({ body: { email: 'non-e-un-indirizzo' }, requestIp: null }),
    (error: { statusCode?: number }) => error.statusCode === 400,
  );
});

test('un campo di troppo nel payload viene rifiutato', async () => {
  const { servizio } = creaServizio();

  await assert.rejects(
    servizio.requestReset({
      body: { email: 'utente@esempio.it', userId: 'utente-2' },
      requestIp: null,
    }),
    (error: { statusCode?: number }) => error.statusCode === 400,
  );
});

// --- Il controllo del link -------------------------------------------------

test('il controllo dice di no a un token inesistente, scaduto o gia usato', async () => {
  const inesistente = creaServizio({ tokenRow: null });
  const scaduto = creaServizio({
    tokenRow: {
      id: 'riga-1',
      userId: 'utente-1',
      expiresAt: new Date(NOW.getTime() - 1),
      usedAt: null,
    },
  });
  const usato = creaServizio({
    tokenRow: {
      id: 'riga-1',
      userId: 'utente-1',
      expiresAt: new Date(NOW.getTime() + 60_000),
      usedAt: NOW,
    },
  });

  for (const caso of [inesistente, scaduto, usato]) {
    assert.deepEqual(
      await caso.servizio.checkToken({ body: { token: 'token-in-chiaro' } }),
      { valid: false },
    );
  }
});

test('il controllo dice di si a un token buono, e non lo consuma', async () => {
  const { servizio, passwordScritte } = creaServizio({
    tokenRow: {
      id: 'riga-1',
      userId: 'utente-1',
      expiresAt: new Date(NOW.getTime() + 60_000),
      usedAt: null,
    },
  });

  assert.deepEqual(
    await servizio.checkToken({ body: { token: 'token-in-chiaro' } }),
    { valid: true },
  );
  assert.deepEqual(passwordScritte, []);
});

// --- La conferma -----------------------------------------------------------

const tokenBuono = {
  id: 'riga-1',
  userId: 'utente-1',
  expiresAt: new Date(NOW.getTime() + 60_000),
  usedAt: null,
};

test('la conferma scrive la password nuova e la data che fa cadere le sessioni', async () => {
  const { servizio, passwordScritte } = creaServizio({ tokenRow: tokenBuono });

  const risposta = await servizio.confirmReset({
    body: { token: 'token-in-chiaro', newPassword: 'password-nuova-lunga' },
  });

  assert.deepEqual(risposta, { reset: true });
  assert.deepEqual(passwordScritte, [
    {
      userId: 'utente-1',
      passwordHash: 'hash(password-nuova-lunga)',
      // ⚠️ E' questa data a revocare le sessioni aperte con la password
      // vecchia (`server/guards/requireAuth.ts`). Se sparisse, il recupero
      // password funzionerebbe lo stesso e nessuno se ne accorgerebbe.
      passwordChangedAt: NOW,
    },
  ]);
});

test('un token gia usato, scaduto o inesistente danno tutti lo stesso errore', async () => {
  const casi = [
    null,
    { ...tokenBuono, usedAt: NOW },
    { ...tokenBuono, expiresAt: new Date(NOW.getTime() - 1) },
  ];

  for (const tokenRow of casi) {
    const { servizio } = creaServizio({ tokenRow });

    await assert.rejects(
      servizio.confirmReset({
        body: { token: 'token-in-chiaro', newPassword: 'password-nuova-lunga' },
      }),
      (error: { statusCode?: number; code?: string }) =>
        error.statusCode === 400 && error.code === 'INVALID_RESET_TOKEN',
    );
  }
});

test('se un altra richiesta ha bruciato il token per prima, questa non scrive niente', async () => {
  // `markUsed` che torna `false` e' esattamente cio' che succede quando due
  // richieste con lo stesso token arrivano insieme: la seconda trova la riga
  // gia' consumata e non tocca nessuna password.
  const { servizio, passwordScritte } = creaServizio({
    tokenRow: tokenBuono,
    markUsedTorna: false,
  });

  await assert.rejects(
    servizio.confirmReset({
      body: { token: 'token-in-chiaro', newPassword: 'password-nuova-lunga' },
    }),
    (error: { code?: string }) => error.code === 'INVALID_RESET_TOKEN',
  );
  assert.deepEqual(passwordScritte, []);
});

test('la conferma brucia anche gli altri link ancora aperti dello stesso utente', async () => {
  const { servizio, bruciature } = creaServizio({ tokenRow: tokenBuono });

  await servizio.confirmReset({
    body: { token: 'token-in-chiaro', newPassword: 'password-nuova-lunga' },
  });

  assert.deepEqual(bruciature, [{ userId: 'utente-1' }]);
});

test('una password nuova sotto gli 8 caratteri viene rifiutata prima di toccare il token', async () => {
  const { servizio, passwordScritte } = creaServizio({ tokenRow: tokenBuono });

  await assert.rejects(
    servizio.confirmReset({ body: { token: 'token-in-chiaro', newPassword: 'corta' } }),
    (error: { statusCode?: number }) => error.statusCode === 400,
  );
  assert.deepEqual(passwordScritte, []);
});

test('la conferma non consegna nessun token di sessione', async () => {
  const { servizio } = creaServizio({ tokenRow: tokenBuono });

  const risposta = await servizio.confirmReset({
    body: { token: 'token-in-chiaro', newPassword: 'password-nuova-lunga' },
  });

  // Chi reimposta la password passa dalla schermata di accesso: e' la nota 4
  // del servizio, ed e' la differenza voluta rispetto all'invito Team.
  assert.deepEqual(Object.keys(risposta), ['reset']);
});
