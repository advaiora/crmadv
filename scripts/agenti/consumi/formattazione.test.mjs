// Test di formattazione.mjs (node --test, lanciati da `npm run test:scripts`).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aParole,
  barra,
  comeSiamoMessi,
  durataAParole,
  ilPerCento,
  mln,
  n0,
  n1,
  n2,
  nomeProgettoLeggibile,
  quando,
  unitaAlMinuto,
  velocita,
} from './formattazione.mjs';

describe('numeri in italiano', () => {
  it('n1/n0/mln usano la virgola come separatore decimale', () => {
    assert.equal(n1(3.14), '3,1');
    assert.equal(n0(3.6), '4');
    assert.equal(mln(2_500_000), '2,50M');
  });

  it('aParole sceglie la scala giusta', () => {
    assert.equal(aParole(3_200_000), '3,2 milioni');
    assert.equal(aParole(45_600), '46 mila');
    assert.equal(aParole(999), '999');
  });

  it('durataAParole: minuti sotto l\'ora, ore e minuti sopra', () => {
    assert.equal(durataAParole(47 * 60000), '47 min');
    assert.equal(durataAParole(82 * 60000), '1h 22m');
    assert.equal(durataAParole(120 * 60000), '2h 00m');
  });

  it('n2 usa la virgola e due decimali', () => {
    assert.equal(n2(0.4122), '0,41');
    assert.equal(n2(1.5), '1,50');
  });
});

describe('velocità di consumo (unità/min)', () => {
  it('unitaAlMinuto: unità sui minuti arrotondati (gli stessi della colonna durata)', () => {
    assert.equal(unitaAlMinuto(47.4, 115 * 60000), 47.4 / 115);
    // 59 secondi si stampano "1 min": anche la velocità usa quel minuto.
    assert.equal(unitaAlMinuto(10, 59000), 10);
    assert.equal(unitaAlMinuto(10, 29000), null);
    assert.equal(unitaAlMinuto(10, 0), null);
  });

  it('velocita: stringa in italiano, null quando il rate non ha senso', () => {
    assert.equal(velocita(47.4, 115 * 60000), '0,41 unità/min');
    // Il numero dell'analisi del 4/8: 288,9 unità in 542 minuti di lavoro.
    assert.equal(velocita(288.9, 542 * 60000), '0,53 unità/min');
    assert.equal(velocita(5, 29000), null);
  });
});

describe('ilPerCento (elisione dell\'articolo)', () => {
  it("elide davanti a uno, otto, undici e ottanta-ottantanove", () => {
    assert.equal(ilPerCento(1), "l'1%");
    assert.equal(ilPerCento(8), "l'8%");
    assert.equal(ilPerCento(11), "l'11%");
    assert.equal(ilPerCento(85), "l'85%");
  });

  it('non elide negli altri casi', () => {
    assert.equal(ilPerCento(5), 'il 5%');
    assert.equal(ilPerCento(18), 'il 18%');
    assert.equal(ilPerCento(90), 'il 90%');
  });

  it('sotto la mezza unita\' dice "meno dell\'1%", ma lo zero vero resta zero', () => {
    assert.equal(ilPerCento(0.3), "meno dell'1%");
    assert.equal(ilPerCento(0), 'il 0%');
  });
});

describe('quando', () => {
  it("stampa l'ora del computer nel formato del registro", () => {
    // Costruita con la stessa ora locale del computer: il test non dipende dal fuso.
    const t = new Date(2026, 0, 5, 9, 7).getTime();
    assert.equal(quando(t), '2026-01-05 09:07');
  });
});

describe('comeSiamoMessi', () => {
  it('cambia consiglio alle soglie dichiarate', () => {
    assert.match(comeSiamoMessi(14.9), /quasi intatta/);
    assert.match(comeSiamoMessi(15), /un terzo/);
    assert.match(comeSiamoMessi(59.9), /metà/);
    assert.match(comeSiamoMessi(79.9), /due terzi/);
    assert.match(comeSiamoMessi(80), /vicino al limite/);
  });
});

describe('barra', () => {
  it('riempe in proporzione e non sborda mai', () => {
    assert.equal(barra(0.5, 10), '#####.....');
    assert.equal(barra(2, 10), '##########');
    assert.equal(barra(-1, 10), '..........');
  });
});

describe('nomeProgettoLeggibile', () => {
  it('accorcia il percorso-cartella nei due formati noti', () => {
    assert.equal(nomeProgettoLeggibile('C--Users-jacop-Documents-crmadv'), 'crmadv');
    assert.equal(nomeProgettoLeggibile('D--altro-progetto'), 'altro-progetto');
    assert.equal(nomeProgettoLeggibile('senza-prefisso'), 'senza-prefisso');
  });
});
