import assert from 'node:assert/strict';
import test from 'node:test';
import { mailCrypto } from '../modules/mail/mail.crypto.js';
import {
  mailRepository,
  type ImpostazioniMailRecord,
} from '../modules/mail/mail.repository.js';
import {
  readMailSettingsFromDatabase,
  resolveMailSettingsDettagliato,
  resolveMailTransportDettagliato,
} from './mail.js';

// La decisione piu' importante di tutto il modulo mail: QUALE server viene
// usato davvero per spedire. Sta scritta a parole in tre commenti, e finche'
// non c'era questo file non la verificava niente — i test del service iniettano
// un `resolveSettings` finto, quindi saltano esattamente questa parte.
//
// `mailRepository` e `mailCrypto` sono oggetti: si sostituiscono i metodi per
// la durata del test e si rimettono a posto alla fine, senza toccare database
// ne' chiavi di cifratura vere.

const RIGA: ImpostazioniMailRecord = {
  workspaceId: 'ws-1',
  attivo: true,
  server: 'mail.database.it',
  porta: 2525,
  connessioneSicura: true,
  retePrivataConsentita: false,
  utente: 'utente-db',
  mittente: 'da-database@esempio.it',
  ciphertext: 'cifrata',
  iv: 'iv',
  authTag: 'tag',
  keyVersion: 1,
  updatedAt: new Date('2026-08-18T10:00:00.000Z'),
};

type Scenario = {
  riga?: typeof RIGA | null;
  decifra?: () => Promise<string | null>;
  ambiente?: Record<string, string | undefined>;
};

const conScenario = async (scenario: Scenario, prova: () => Promise<void>) => {
  const findOriginale = mailRepository.findByWorkspaceId;
  const decryptOriginale = mailCrypto.decrypt;
  const ambienteOriginale = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
  };

  mailRepository.findByWorkspaceId = async () => (scenario.riga ?? null) as never;
  mailCrypto.decrypt = (scenario.decifra ?? (async () => 'segreto')) as never;
  for (const [chiave, valore] of Object.entries(scenario.ambiente ?? {})) {
    if (valore === undefined) {
      delete process.env[chiave];
    } else {
      process.env[chiave] = valore;
    }
  }

  try {
    await prova();
  } finally {
    mailRepository.findByWorkspaceId = findOriginale;
    mailCrypto.decrypt = decryptOriginale;
    for (const [chiave, valore] of Object.entries(ambienteOriginale)) {
      if (valore === undefined) {
        delete process.env[chiave];
      } else {
        process.env[chiave] = valore;
      }
    }
  }
};

const AMBIENTE_CONFIGURATO = {
  SMTP_HOST: 'mail.ambiente.it',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'utente-env',
  SMTP_PASS: 'password-env',
  EMAIL_FROM: 'da-ambiente@esempio.it',
};

const AMBIENTE_VUOTO = {
  SMTP_HOST: undefined,
  SMTP_PORT: undefined,
  SMTP_SECURE: undefined,
  SMTP_USER: undefined,
  SMTP_PASS: undefined,
  EMAIL_FROM: undefined,
};

test('la configurazione a database vince sulle variabili d\'ambiente', async () => {
  await conScenario({ riga: RIGA, ambiente: AMBIENTE_CONFIGURATO }, async () => {
    const esito = await resolveMailSettingsDettagliato('ws-1');

    assert.equal(esito.esito, 'ok');
    if (esito.esito !== 'ok') return;
    assert.equal(esito.source, 'database');
    assert.equal(esito.settings.host, 'mail.database.it');
    assert.equal(esito.settings.port, 2525);
    assert.equal(esito.settings.from, 'da-database@esempio.it');
  });
});

test('in pausa (attivo = false) si ripiega sulle variabili d\'ambiente', async () => {
  await conScenario(
    { riga: { ...RIGA, attivo: false }, ambiente: AMBIENTE_CONFIGURATO },
    async () => {
      const esito = await resolveMailSettingsDettagliato('ws-1');

      assert.equal(esito.esito, 'ok');
      if (esito.esito !== 'ok') return;
      assert.equal(esito.source, 'env');
      assert.equal(esito.settings.host, 'mail.ambiente.it');
    },
  );
});

test('senza workspace non si guarda nemmeno il database', async () => {
  let interrogato = false;
  await conScenario(
    {
      riga: RIGA,
      ambiente: AMBIENTE_CONFIGURATO,
    },
    async () => {
      const find = mailRepository.findByWorkspaceId;
      mailRepository.findByWorkspaceId = async (...args) => {
        interrogato = true;
        return find(...args);
      };

      const esito = await resolveMailSettingsDettagliato();

      assert.equal(esito.esito, 'ok');
      if (esito.esito !== 'ok') return;
      assert.equal(esito.source, 'env');
      assert.equal(interrogato, false);
    },
  );
});

test('password non decifrabile: "illeggibile", e NON si ripiega sull\'ambiente', async () => {
  await conScenario(
    {
      riga: RIGA,
      decifra: async () => {
        throw new Error('Unable to unwrap workspace encryption key.');
      },
      ambiente: AMBIENTE_CONFIGURATO,
    },
    async () => {
      const esito = await resolveMailSettingsDettagliato('ws-1');

      // Se qui uscisse 'ok' con source 'env', il CRM spedirebbe da un mittente
      // che nessuno ha configurato, senza dirlo a nessuno.
      assert.equal(esito.esito, 'illeggibile');
    },
  );
});

test('password non decifrabile: non diventa un\'eccezione per chi spedisce', async () => {
  await conScenario(
    {
      riga: RIGA,
      decifra: async () => {
        throw new Error('Unable to unwrap workspace encryption key.');
      },
      ambiente: AMBIENTE_CONFIGURATO,
    },
    async () => {
      // Il punto della segnalazione del revisore: un throw qui diventava un 500
      // sugli inviti e un silenzio totale sui preventivi.
      const esito = await resolveMailTransportDettagliato({ workspaceId: 'ws-1' });
      assert.equal(esito.esito, 'illeggibile');
    },
  );
});

test('la casella finta di sviluppo non maschera una configurazione illeggibile', async () => {
  await conScenario(
    {
      riga: RIGA,
      decifra: async () => {
        throw new Error('Unable to unwrap workspace encryption key.');
      },
      ambiente: AMBIENTE_VUOTO,
    },
    async () => {
      const esito = await resolveMailTransportDettagliato({
        workspaceId: 'ws-1',
        allowDevFallback: true,
      });

      assert.equal(esito.esito, 'illeggibile');
    },
  );
});

test('niente a database e niente in ambiente: "assente"', async () => {
  await conScenario({ riga: null, ambiente: AMBIENTE_VUOTO }, async () => {
    const esito = await resolveMailSettingsDettagliato('ws-1');
    assert.equal(esito.esito, 'assente');
  });
});

test('una riga senza password resta valida (server senza autenticazione)', async () => {
  await conScenario(
    {
      riga: { ...RIGA, ciphertext: null, iv: null, authTag: null, keyVersion: null, utente: null },
      decifra: async () => null,
      ambiente: AMBIENTE_VUOTO,
    },
    async () => {
      const esito = await readMailSettingsFromDatabase('ws-1');

      assert.equal(esito.esito, 'ok');
      if (esito.esito !== 'ok') return;
      assert.equal(esito.settings.pass, null);
      assert.equal(esito.settings.user, null);
    },
  );
});
