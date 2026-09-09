// Prove della risoluzione del logo dei PDF, cioe' dell'unico punto in cui la
// generazione di un PDF va a prendere qualcosa in rete a un indirizzo che ha scelto
// l'utente (`logoUrl` del branding del workspace).
//
// Quello che si prova qui e' che quel prelievo passi da `safeFetch`: prima il controllo
// si fermava al NOME dell'host, e un nome pubblico che risolve a `127.0.0.1` o a
// `169.254.169.254` passava intero (CRMA-65).

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLogoBuffer } from './pdf.js';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const risolveA = (...indirizzi: string[]) =>
  async () => indirizzi.map((address) => ({ address }));

// Sostituisce `fetch` con una spia, e restituisce le chiamate ricevute piu' il modo di
// rimettere a posto l'originale. Se il codice sotto prova non deve uscire in rete, il
// conteggio a zero e' meta' della prova.
const spiaFetch = (risposte: Array<() => Response> = []) => {
  const originale = globalThis.fetch;
  const chiamate: Array<{ url: string; init: RequestInit | undefined }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    chiamate.push({ url: String(input), init });
    const prossima = risposte.shift();
    if (!prossima) {
      throw new Error(`fetch non prevista verso ${String(input)}`);
    }
    return prossima();
  }) as typeof fetch;

  return { chiamate, ripristina: () => { globalThis.fetch = originale; } };
};

test('resolveLogoBuffer: un nome pubblico che risolve a un IP privato non viene scaricato', async () => {
  const spia = spiaFetch();
  try {
    const buffer = await resolveLogoBuffer('https://logo.esempio.com/logo.png', {
      risolviDns: risolveA('127.0.0.1'),
    });

    assert.equal(buffer, null);
    // Il punto della correzione: non e' che la risposta venga scartata dopo, e' che la
    // richiesta non parte proprio.
    assert.equal(spia.chiamate.length, 0);
  } finally {
    spia.ripristina();
  }
});

test('resolveLogoBuffer: bloccato anche se solo UNA delle risoluzioni e privata', async () => {
  const spia = spiaFetch();
  try {
    const buffer = await resolveLogoBuffer('https://logo-doppio.esempio.com/logo.png', {
      risolviDns: risolveA('203.0.113.10', '169.254.169.254'),
    });

    assert.equal(buffer, null);
    assert.equal(spia.chiamate.length, 0);
  } finally {
    spia.ripristina();
  }
});

test('resolveLogoBuffer: un redirect verso i metadati della macchina non viene seguito', async () => {
  const spia = spiaFetch([
    () => new Response(null, {
      status: 302,
      headers: { location: 'https://169.254.169.254/latest/meta-data/' },
    }),
  ]);

  try {
    const buffer = await resolveLogoBuffer('https://logo-redirect.esempio.com/logo.png', {
      risolviDns: risolveA('203.0.113.10'),
    });

    assert.equal(buffer, null);
    // Una sola chiamata: il salto successivo e' stato validato e rifiutato prima di
    // partire. E la prima e' stata fatta a redirect 'manual', altrimenti sarebbe stato
    // `fetch` a seguirlo per conto suo.
    assert.equal(spia.chiamate.length, 1);
    assert.equal(spia.chiamate[0].init?.redirect, 'manual');
  } finally {
    spia.ripristina();
  }
});

test('resolveLogoBuffer: un URL con uno schema diverso da http(s) non tocca la rete', async () => {
  const spia = spiaFetch();
  try {
    assert.equal(await resolveLogoBuffer('file:///etc/passwd'), null);
    assert.equal(await resolveLogoBuffer('ftp://esempio.com/logo.png'), null);
    assert.equal(spia.chiamate.length, 0);
  } finally {
    spia.ripristina();
  }
});

test('resolveLogoBuffer: un logo pubblico viene scaricato, e la seconda volta arriva dalla cache', async () => {
  const spia = spiaFetch([
    () => new Response(PNG_BYTES, { status: 200, headers: { 'content-type': 'image/png' } }),
  ]);

  try {
    const opzioni = { risolviDns: risolveA('203.0.113.10') };
    const primo = await resolveLogoBuffer('https://logo-pubblico.esempio.com/logo.png', opzioni);
    const secondo = await resolveLogoBuffer('https://logo-pubblico.esempio.com/logo.png', opzioni);

    assert.ok(primo);
    assert.deepEqual(primo, PNG_BYTES);
    assert.deepEqual(secondo, PNG_BYTES);
    // La spia aveva una sola risposta in canna: se la cache non funzionasse, la seconda
    // chiamata sarebbe fallita.
    assert.equal(spia.chiamate.length, 1);
  } finally {
    spia.ripristina();
  }
});

test('resolveLogoBuffer: un tipo di file non previsto viene scartato', async () => {
  const spia = spiaFetch([
    () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }),
  ]);

  try {
    const buffer = await resolveLogoBuffer('https://logo-html.esempio.com/logo.png', {
      risolviDns: risolveA('203.0.113.10'),
    });

    assert.equal(buffer, null);
  } finally {
    spia.ripristina();
  }
});

test('resolveLogoBuffer: il data URL resta la via che non passa dalla rete', async () => {
  const spia = spiaFetch();
  try {
    const buffer = await resolveLogoBuffer(`data:image/png;base64,${PNG_BYTES.toString('base64')}`);

    assert.deepEqual(buffer, PNG_BYTES);
    assert.equal(spia.chiamate.length, 0);
  } finally {
    spia.ripristina();
  }
});

test('resolveLogoBuffer: senza logo non fa niente', async () => {
  assert.equal(await resolveLogoBuffer(null), null);
  assert.equal(await resolveLogoBuffer('   '), null);
});
