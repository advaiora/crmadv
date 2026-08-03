// Test di agenti.mjs (node --test, lanciati da `npm run test:scripts`).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PREZZI, PREZZO_IGNOTO } from './prezzi.mjs';
import { abbinaPerOrdine, analizzaAgenti, costoSeFosseInLinea } from './agenti.mjs';

describe('costoSeFosseInLinea', () => {
  it('niente testo tenuto fuori, niente costo', () => {
    assert.equal(costoSeFosseInLinea(0, [], 'claude-opus-5'), 0);
    assert.equal(costoSeFosseInLinea(-5, [], 'claude-opus-5'), 0);
  });

  it('una scrittura in memoria piu' + ' una rilettura per ogni risposta dopo', () => {
    const opusIn = PREZZI['claude-opus-5'].in;
    // Senza risposte dopo: solo la scrittura (x2), pesata col modello di ripiego.
    assert.ok(Math.abs(costoSeFosseInLinea(1e6, [], 'claude-opus-5') - opusIn * 2) < 1e-9);
    // Con due risposte dopo: scrittura pesata sul PRIMO modello del dopo, piu' due riletture (x0,1 ciascuna).
    const dopo = [{ modello: 'claude-opus-5' }, { modello: 'claude-opus-5' }];
    assert.ok(Math.abs(costoSeFosseInLinea(1e6, dopo, 'ignorato') - (opusIn * 2 + opusIn * 0.1 * 2)) < 1e-9);
  });

  it('ogni rilettura e' + ' pesata col modello di QUELLA risposta', () => {
    const dopo = [{ modello: 'claude-opus-5' }, { modello: 'claude-haiku-4-5' }];
    const atteso =
      PREZZI['claude-opus-5'].in * 2 + // scrittura sul primo modello del dopo
      PREZZI['claude-opus-5'].in * 0.1 +
      PREZZI['claude-haiku-4-5'].in * 0.1;
    assert.ok(Math.abs(costoSeFosseInLinea(1e6, dopo, 'x') - atteso) < 1e-9);
  });

  it('modello di ripiego sconosciuto: prezzo di ripiego', () => {
    assert.ok(Math.abs(costoSeFosseInLinea(1e6, [], 'boh') - PREZZO_IGNOTO.in * 2) < 1e-9);
  });
});

describe('abbinaPerOrdine', () => {
  it('accoppia in ordine di tempo, sessione per sessione, saltando i gia' + ' abbinati', () => {
    const lanci = new Map([
      ['l1', { sessione: 's1', t: 10, abbinato: false, tipo: 'esploratore' }],
      ['l2', { sessione: 's1', t: 20, abbinato: false, tipo: 'revisore' }],
      ['l3', { sessione: 's1', t: 5, abbinato: true, tipo: 'gia-abbinato' }],
      ['l4', { sessione: 's2', t: 1, abbinato: false, tipo: 'altro' }],
    ]);
    const agenti = [
      { id: 'a2', sessione: 's1', inizio: 25 },
      { id: 'a1', sessione: 's1', inizio: 12 },
    ];
    const abbinamenti = abbinaPerOrdine(agenti, lanci);
    assert.equal(abbinamenti.get('a1').tipo, 'esploratore');
    assert.equal(abbinamenti.get('a2').tipo, 'revisore');
    assert.equal(abbinamenti.size, 2);
  });

  it('piu' + ' agent che lanci: gli avanzi restano senza tipo', () => {
    const lanci = new Map([['l1', { sessione: 's1', t: 1, abbinato: false, tipo: 'unico' }]]);
    const agenti = [
      { id: 'a1', sessione: 's1', inizio: 2 },
      { id: 'a2', sessione: 's1', inizio: 3 },
    ];
    const abbinamenti = abbinaPerOrdine(agenti, lanci);
    assert.equal(abbinamenti.size, 1);
    assert.ok(abbinamenti.has('a1'));
  });
});

describe('analizzaAgenti', () => {
  // Scenario minimo: una sessione principale con tre chiamate, un agent del
  // team (esploratore) che lavora in mezzo, un agent in una sessione ripresa
  // (senza chiamate principali) che NON deve essere conteggiato.
  const M = 'claude-opus-5';
  const chiamate = [
    { t: 10, sessione: 's1', nostro: true, subagent: false, agente: null, modello: M, peso: 1, uscita: 100, contesto: 1000 },
    // l'agent: due chiamate, il contesto cresce di 50.000, l'ultima uscita e' la risposta finale
    { t: 20, sessione: 's1', nostro: true, subagent: true, agente: 'ag1', modello: M, peso: 2, uscita: 10, contesto: 10_000 },
    { t: 30, sessione: 's1', nostro: true, subagent: true, agente: 'ag1', modello: M, peso: 3, uscita: 2_000, contesto: 60_000 },
    // due risposte principali DOPO l'agent: sono le riletture risparmiate
    { t: 40, sessione: 's1', nostro: true, subagent: false, agente: null, modello: M, peso: 1, uscita: 100, contesto: 2000 },
    { t: 50, sessione: 's1', nostro: true, subagent: false, agente: null, modello: M, peso: 1, uscita: 100, contesto: 3000 },
    // agent di un ALTRO progetto: fuori dal conto quando soloNostro=true
    { t: 60, sessione: 's9', nostro: false, subagent: true, agente: 'ag-altrui', modello: M, peso: 9, uscita: 1, contesto: 1 },
    // agent in sessione ripresa: nessuna chiamata principale nella sua sessione
    { t: 70, sessione: 's-ripresa', nostro: true, subagent: true, agente: 'ag2', modello: M, peso: 4, uscita: 500, contesto: 20_000 },
    // seconda sessione: la conversazione principale gira su Haiku, l'agent su
    // Opus, e DOPO l'agent non c'e' piu' niente. Serve a provare che il
    // controfattuale usa il modello della conversazione, non quello dell'agent.
    { t: 100, sessione: 's2', nostro: true, subagent: false, agente: null, modello: 'claude-haiku-4-5', peso: 1, uscita: 50, contesto: 500 },
    { t: 110, sessione: 's2', nostro: true, subagent: true, agente: 'ag3', modello: M, peso: 1, uscita: 100, contesto: 5_000 },
    { t: 112, sessione: 's2', nostro: true, subagent: true, agente: 'ag3', modello: M, peso: 1, uscita: 100, contesto: 15_000 },
  ];
  const anagrafica = {
    tipiAgente: new Map([
      ['ag1', { tipo: 'esploratore', descrizione: 'mappa' }],
      ['ag2', { tipo: 'claude', descrizione: 'di serie' }],
      ['ag3', { tipo: 'general-purpose', descrizione: 'in chiusura' }],
    ]),
    lanci: new Map(),
    testoFinale: new Map([['ag1', { t: 30, car: 40_000 }]]),
  };

  it('separa il team dagli agent di serie e scarta gli agent di altri progetti', () => {
    const esito = analizzaAgenti(chiamate, anagrafica, true);
    assert.equal(esito.quanti, 3);
    assert.equal(esito.team.quanti, 1);
    assert.equal(esito.serie.quanti, 2);
    assert.ok(!esito.agenti.some((a) => a.id === 'ag-altrui'));
  });

  it('il controfattuale si pesa col modello della conversazione PRINCIPALE, non con quello dell\'agent', () => {
    const esito = analizzaAgenti(chiamate, anagrafica, true);
    const ag3 = esito.agenti.find((a) => a.id === 'ag3');
    assert.equal(ag3.modelloPrincipale, 'claude-haiku-4-5'); // l'ultima principale PRIMA dell'agent
    assert.equal(ag3.rispostePoi, 0);
    // tenutoFuori = (15.000-5.000) - 100 = 9.900 token; nessuna risposta dopo:
    // solo la scrittura in memoria, al prezzo d'ingresso di Haiku (1), x2.
    const atteso = (9_900 * PREZZI['claude-haiku-4-5'].in * 2) / 1e6;
    assert.ok(Math.abs(ag3.costoSeInLinea - atteso) < 1e-9);
  });

  it("l'agent conteggiato: accumulo, riserva dal testo, riletture dopo", () => {
    const esito = analizzaAgenti(chiamate, anagrafica, true);
    const ag1 = esito.agenti.find((a) => a.id === 'ag1');
    assert.equal(ag1.accumulato, 50_000); // 60.000 - 10.000
    // uscita registrata 2.000, ma il testo dice 40.000 caratteri = 10.000 token: vince la riserva
    assert.equal(ag1.restituito, 10_000);
    assert.equal(ag1.tenutoFuori, 40_000);
    assert.equal(ag1.rispostePoi, 2);
    assert.equal(ag1.abbinato, true);
    assert.ok(ag1.risparmio !== null);
  });

  it('un agent in sessione ripresa si dichiara, non si conta come perdita', () => {
    const esito = analizzaAgenti(chiamate, anagrafica, true);
    const ag2 = esito.agenti.find((a) => a.id === 'ag2');
    assert.equal(ag2.abbinato, false);
    assert.equal(ag2.risparmio, null);
    assert.equal(esito.nonConteggiati, 1);
    // ...e il suo costo finisce fra gli esclusi del bilancio, non nel conteggio
    // (l'altro agent di serie, ag3, resta conteggiato: e' abbinato)
    assert.equal(esito.serie.conteggiati, 1);
    assert.equal(esito.serie.esclusi, 1);
    assert.equal(esito.serie.costoEsclusi, 4);
  });
});
