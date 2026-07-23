import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeSeoHtml, type SeoIssue } from './seo-analyzer.js';

const hasIssue = (issues: SeoIssue[], code: string) => issues.some((issue) => issue.code === code);

const WELL_FORMED_HTML = `<!doctype html>
<html lang="it">
<head>
  <title>Agenzia creativa a Milano — servizi di design e marketing</title>
  <meta name="description" content="Siamo un'agenzia creativa che aiuta le aziende a crescere con design, siti web e campagne su misura. Scopri i nostri servizi e contattaci oggi stesso.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://example.com/">
  <meta property="og:title" content="Agenzia creativa">
  <meta property="og:description" content="Design e marketing su misura">
  <meta property="og:image" content="https://example.com/og.png">
</head>
<body>
  <h1>Agenzia creativa</h1>
  <h2>Servizi</h2>
  <img src="/team.jpg" alt="Il nostro team">
</body>
</html>`;

test('analyzeSeoHtml: pagina ben formata ha punteggio alto e nessun problema grave', () => {
  const result = analyzeSeoHtml({
    html: WELL_FORMED_HTML,
    url: 'https://example.com/',
    requestedKeywords: [],
  });

  assert.equal(result.h1Count, 1);
  assert.equal(result.metaTitle?.startsWith('Agenzia creativa'), true);
  assert.ok(result.score >= 90, `atteso score alto, ottenuto ${result.score}`);
  assert.equal(result.issues.some((issue) => issue.severity === 'high'), false);
});

test('analyzeSeoHtml: pagina spoglia accumula problemi gravi e punteggio basso', () => {
  const result = analyzeSeoHtml({
    html: '<html><body><p>ciao</p></body></html>',
    url: 'https://example.com/',
    requestedKeywords: [],
  });

  assert.equal(result.metaTitle, null);
  assert.equal(result.metaDescription, null);
  assert.equal(result.h1Count, 0);
  assert.equal(hasIssue(result.issues, 'title-missing'), true);
  assert.equal(hasIssue(result.issues, 'meta-description-missing'), true);
  assert.equal(hasIssue(result.issues, 'h1-missing'), true);
  assert.ok(result.score <= 40, `atteso score basso, ottenuto ${result.score}`);
});

test('analyzeSeoHtml: robots noindex e un problema grave dedicato', () => {
  const html = `<html lang="it"><head>
    <title>Titolo abbastanza lungo per non penalizzare il punteggio ok</title>
    <meta name="robots" content="noindex, follow">
  </head><body><h1>x</h1></body></html>`;
  const result = analyzeSeoHtml({ html, url: 'https://example.com/', requestedKeywords: [] });

  assert.equal(hasIssue(result.issues, 'robots-noindex'), true);
  assert.equal(
    result.issues.find((issue) => issue.code === 'robots-noindex')?.severity,
    'high',
  );
});

test('analyzeSeoHtml: legge i meta anche con attributi in ordine inverso (content prima di name)', () => {
  const html = `<html lang="it"><head>
    <title>Un titolo di lunghezza adeguata per il test seo odierno</title>
    <meta content="Una descrizione sufficientemente lunga da rientrare tra settanta e centosessanta caratteri, quindi valida per il test." name="description">
  </head><body><h1>x</h1></body></html>`;
  const result = analyzeSeoHtml({ html, url: 'https://example.com/', requestedKeywords: [] });

  assert.equal(result.metaDescription?.startsWith('Una descrizione'), true);
  assert.equal(hasIssue(result.issues, 'meta-description-missing'), false);
});

test("analyzeSeoHtml: keyword richieste mancanti generano un problema con l'elenco", () => {
  const result = analyzeSeoHtml({
    html: WELL_FORMED_HTML,
    url: 'https://example.com/',
    requestedKeywords: ['ristorante', 'design'],
  });

  assert.deepEqual(result.missingKeywords, ['ristorante']);
  assert.equal(hasIssue(result.issues, 'keyword-coverage'), true);
});

test('analyzeSeoHtml: URL http (non https) segnala il problema not-https', () => {
  const result = analyzeSeoHtml({
    html: WELL_FORMED_HTML,
    url: 'http://example.com/',
    requestedKeywords: [],
  });

  assert.equal(hasIssue(result.issues, 'not-https'), true);
});

test('analyzeSeoHtml: immagini senza alt segnalano la copertura mancante', () => {
  const html = `<html lang="it"><head>
    <title>Un titolo di lunghezza adeguata per il test seo odierno</title>
    <meta name="description" content="Una descrizione sufficientemente lunga da rientrare tra settanta e centosessanta caratteri, quindi valida per il test.">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head><body><h1>x</h1><img src="a.jpg"><img src="b.jpg" alt=""></body></html>`;
  const result = analyzeSeoHtml({ html, url: 'https://example.com/', requestedKeywords: [] });

  assert.equal(hasIssue(result.issues, 'image-alt-missing'), true);
});
