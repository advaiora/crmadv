// Test di lettura.mjs (node --test, lanciati da `npm run test:scripts`).
// La parte preziosa e' la prova su una finta cartella-registri costruita in
// tmp: inchioda la nota #36 (subagent nelle sottocartelle subagents/) e la
// nota #39 (righe multiple con lo stesso requestId fuse tenendo il massimo).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PREZZI } from './prezzi.mjs';
import { elencaJsonl, leggiChiamate, peso } from './lettura.mjs';

describe('peso', () => {
  it('pesa ogni tipo di token col suo moltiplicatore', () => {
    const p = PREZZI['claude-opus-5'];
    const valore = peso(
      { input_tokens: 1e6, output_tokens: 1e6, cache_creation_input_tokens: 1e6, cache_read_input_tokens: 1e6 },
      'claude-opus-5',
    );
    const atteso = p.in + p.out + p.in * 2 + p.in * 0.1;
    assert.ok(Math.abs(valore - atteso) < 1e-9);
  });

  it('i campi mancanti valgono zero', () => {
    assert.equal(peso({}, 'claude-opus-5'), 0);
  });
});

describe('leggiChiamate su una cartella-registri finta', () => {
  let base;

  const riga = (obj) => `${JSON.stringify(obj)}\n`;
  const uso = (out, contesto = 0) => ({
    input_tokens: 10,
    output_tokens: out,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: contesto,
  });

  before(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'consumi-test-'));
    const progetto = path.join(base, 'C--Users-test-Documents-demo');
    const sessione = path.join(progetto, 'sess-1');
    const subagents = path.join(sessione, 'subagents');
    fs.mkdirSync(subagents, { recursive: true });

    // Transcript principale: il lancio dell'agent (tool_use + tool_result con
    // agentId) e una chiamata annotata su TRE righe con lo stesso requestId,
    // coi contatori che crescono: va fusa tenendo il massimo (nota #39).
    fs.writeFileSync(
      path.join(progetto, 'sess-1.jsonl'),
      riga({
        sessionId: 'sess-1',
        timestamp: '2026-08-01T10:00:00Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'toolu_1', name: 'Agent', input: { subagent_type: 'esploratore', description: 'mappa' } },
          ],
        },
      }) +
        riga({
          sessionId: 'sess-1',
          timestamp: '2026-08-01T10:00:05Z',
          message: {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'lanciato. agentId: abc123 (interno)' }],
          },
        }) +
        riga({ sessionId: 'sess-1', timestamp: '2026-08-01T10:01:00Z', requestId: 'req-1', message: { role: 'assistant', usage: uso(3) } }) +
        riga({ sessionId: 'sess-1', timestamp: '2026-08-01T10:01:10Z', requestId: 'req-1', message: { role: 'assistant', usage: uso(500) } }) +
        riga({ sessionId: 'sess-1', timestamp: '2026-08-01T10:01:20Z', requestId: 'req-1', message: { role: 'assistant', usage: uso(1200) } }),
    );

    // Registro del subagent, DENTRO la sottocartella subagents/ (nota #36):
    // una chiamata con usage e una risposta di solo testo (per testoFinale).
    fs.writeFileSync(
      path.join(subagents, 'agent-abc123.jsonl'),
      riga({ sessionId: 'sub-x', timestamp: '2026-08-01T10:02:00Z', requestId: 'req-sub-1', message: { role: 'assistant', usage: uso(50, 4000) } }) +
        riga({
          sessionId: 'sub-x',
          timestamp: '2026-08-01T10:02:30Z',
          message: { role: 'assistant', content: [{ type: 'text', text: 'r'.repeat(800) }] },
        }),
    );

    // Un secondo progetto, per il flag `nostro`.
    const altro = path.join(base, 'C--Users-test-Documents-altro');
    fs.mkdirSync(altro, { recursive: true });
    fs.writeFileSync(
      path.join(altro, 'sess-9.jsonl'),
      riga({ sessionId: 'sess-9', timestamp: '2026-08-01T11:00:00Z', requestId: 'req-9', message: { role: 'assistant', usage: uso(7) } }),
    );
  });

  after(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('trova anche i .jsonl nelle sottocartelle (nota #36)', () => {
    const trovati = elencaJsonl(base);
    assert.equal(trovati.length, 3);
    assert.ok(trovati.some((f) => f.includes('subagents')));
  });

  it('fonde le righe con lo stesso requestId tenendo il massimo (nota #39)', () => {
    const { chiamate } = leggiChiamate(base);
    const principale = chiamate.find((c) => c.sessione === 'sess-1' && !c.subagent);
    assert.equal(principale.uscita, 1200); // non 3, la prima riga
    assert.equal(principale.t, Date.parse('2026-08-01T10:01:20Z'));
  });

  it('attribuisce il subagent alla sessione madre e ne estrae identificativo e tipo', () => {
    const { chiamate, tipiAgente, testoFinale } = leggiChiamate(base);
    const sub = chiamate.find((c) => c.subagent);
    assert.equal(sub.sessione, 'sess-1'); // la cartella nonna, non il sessionId interno
    assert.equal(sub.agente, 'abc123');
    assert.equal(tipiAgente.get('abc123').tipo, 'esploratore');
    assert.equal(testoFinale.get('abc123').car, 800);
  });

  it('etichetta cosa e' + ' nostro ignorando le maiuscole; senza cartella e' + ' tutto nostro', () => {
    const dirNostra = path.join(base, 'C--USERS-TEST-DOCUMENTS-DEMO'); // maiuscole diverse apposta
    const { chiamate } = leggiChiamate(base, dirNostra);
    assert.ok(chiamate.filter((c) => c.sessione === 'sess-1').every((c) => c.nostro));
    assert.ok(chiamate.filter((c) => c.sessione === 'sess-9').every((c) => !c.nostro));

    const senza = leggiChiamate(base);
    assert.ok(senza.chiamate.every((c) => c.nostro));
  });

  it('il contesto e il peso sono calcolati per chiamata e in ordine di tempo', () => {
    const { chiamate } = leggiChiamate(base);
    assert.deepEqual(
      chiamate.map((c) => c.t),
      [...chiamate.map((c) => c.t)].sort((a, b) => a - b),
    );
    const sub = chiamate.find((c) => c.subagent);
    assert.equal(sub.contesto, 10 + 0 + 4000);
    assert.ok(sub.peso > 0);
  });
});
