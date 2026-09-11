import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { generateInviteToken, hashInviteToken } from './team-invite.tokens.js';

const TEAM_INVITE_TOKEN_SECRET_KEY = 'TEAM_INVITE_TOKEN_SECRET';
const AUTH_JWT_SECRET_KEY = 'AUTH_JWT_SECRET';

const restoreEnvValue = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

const withEnv = (
  values: Record<string, string | undefined>,
  run: () => void,
) => {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );

  try {
    for (const [key, value] of Object.entries(values)) {
      restoreEnvValue(key, value);
    }

    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      restoreEnvValue(key, value);
    }
  }
};

test('generateInviteToken returns 32 random bytes in hex', () => {
  const first = generateInviteToken();
  const second = generateInviteToken();

  assert.match(first, /^[0-9a-f]{64}$/u);
  assert.match(second, /^[0-9a-f]{64}$/u);
  assert.notEqual(first, second);
});

test('hashInviteToken uses TEAM_INVITE_TOKEN_SECRET as the HMAC key', () => {
  withEnv(
    {
      [TEAM_INVITE_TOKEN_SECRET_KEY]: 'unit-test-invite-secret',
      [AUTH_JWT_SECRET_KEY]: 'unit-test-super-secret',
    },
    () => {
      const expected = createHmac('sha256', 'unit-test-invite-secret')
        .update('token-di-prova')
        .digest('hex');

      assert.equal(hashInviteToken('token-di-prova'), expected);
    },
  );
});

test('hashInviteToken does not fall back on AUTH_JWT_SECRET when the invite secret is missing', () => {
  withEnv(
    {
      [TEAM_INVITE_TOKEN_SECRET_KEY]: undefined,
      [AUTH_JWT_SECRET_KEY]: 'unit-test-super-secret',
    },
    () => {
      assert.throws(
        () => hashInviteToken('token-di-prova'),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /Missing TEAM_INVITE_TOKEN_SECRET/i);
          return true;
        },
      );
    },
  );
});

test('hashInviteToken rejects a blank invite secret instead of hashing with an empty key', () => {
  withEnv(
    {
      [TEAM_INVITE_TOKEN_SECRET_KEY]: '   ',
      [AUTH_JWT_SECRET_KEY]: 'unit-test-super-secret',
    },
    () => {
      assert.throws(
        () => hashInviteToken('token-di-prova'),
        /Missing TEAM_INVITE_TOKEN_SECRET/i,
      );
    },
  );
});

test('ruotare AUTH_JWT_SECRET non cambia piu\' l\'impronta di un invito', () => {
  let hashPrimaDellaRotazione = '';
  let hashDopoLaRotazione = '';

  withEnv(
    {
      [TEAM_INVITE_TOKEN_SECRET_KEY]: 'unit-test-invite-secret',
      [AUTH_JWT_SECRET_KEY]: 'segreto-sessioni-vecchio',
    },
    () => {
      hashPrimaDellaRotazione = hashInviteToken('token-di-prova');
    },
  );

  withEnv(
    {
      [TEAM_INVITE_TOKEN_SECRET_KEY]: 'unit-test-invite-secret',
      [AUTH_JWT_SECRET_KEY]: 'segreto-sessioni-nuovo-di-zecca',
    },
    () => {
      hashDopoLaRotazione = hashInviteToken('token-di-prova');
    },
  );

  assert.notEqual(hashPrimaDellaRotazione, '');
  assert.equal(hashDopoLaRotazione, hashPrimaDellaRotazione);
});
