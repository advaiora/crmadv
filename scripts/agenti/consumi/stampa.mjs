// Le stampe in italiano: il quadro e il report della finestra passata
// (spezzato da consumi.mjs il 3/8/2026). Solo console.log: i numeri arrivano
// gia' pronti da raccolta.mjs o dalle chiamate lette.
import path from 'node:path';
import { FILE_CALIBRAZIONE, FINESTRA_MS, RADICE, TEAM_DI_PROGETTO } from './config.mjs';
import { accumula, sommaVuota } from './aggregazioni.mjs';
import { MOLT_LETTURA_CACHE, MOLT_SCRITTURA_CACHE } from './prezzi.mjs';
import {
  aParole,
  barra,
  comeSiamoMessi,
  durataAParole,
  ilPerCento,
  mln,
  n0,
  n1,
  nomeProgettoLeggibile,
  quando,
} from './formattazione.mjs';

// Peso della finestra di 5 ore che finisce a `fine` (un'ora passata), con la
// ripartizione per progetto: e' il report del flag --finestra-a, usato per
// ricalcolare i campioni di calibrazione quando cambia il modo di pesare.
export function stampaFinestraPassata(chiamate, fine) {
  const dentro = chiamate.filter((c) => c.t > fine - FINESTRA_MS && c.t <= fine);
  const somma = dentro.reduce(accumula, sommaVuota());
  console.log(`Finestra ${quando(fine - FINESTRA_MS)} → ${quando(fine)} (ora del computer)`);
  console.log(`  peso ${n1(somma.peso)} su ${somma.chiamate} chiamate`);
  const perProgetto = new Map();
  for (const c of dentro) perProgetto.set(c.progetto, (perProgetto.get(c.progetto) || 0) + c.peso);
  for (const [p, v] of [...perProgetto.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${nomeProgettoLeggibile(p).padEnd(40)} ${n1(v)}`);
  }
}

export function stampaQuadro(dati, chiamate, opzioni) {
  const { finestraCorrente: finestra, piccoStorico: picco, agenti } = dati;
  const stima = finestra.stimaPercentuale;
  const frazione = stima ? Math.min(1, stima.percentuale / 100) : finestra.peso / (picco.peso || 1);
  // Le "unità" non dicono niente da sole: quando la taratura c'è, ogni numero si
  // può tradurre in "quanto limite di 5 ore vale". È quella la misura utile.
  const inLimite = (x) => (stima ? ` (circa ${ilPerCento(x * stima.k)} del limite)` : '');

  console.log('');
  console.log("CONSUMI — quanto stai consumando dell'abbonamento");
  console.log("(il limite vale per tutto l'account: qui dentro c'è ogni progetto su cui lavori)");
  console.log('');
  console.log('ADESSO — le ultime 5 ore');
  if (stima) {
    console.log(`  Hai usato circa ${ilPerCento(stima.percentuale)} del limite. ${comeSiamoMessi(stima.percentuale)}`);
    console.log(`  [${barra(frazione)}]`);
    console.log(`  (stima imparata da ${stima.campioni} letture di /usage, sbaglia in media ${n1(stima.scartoMedio)} punti)`);
  } else {
    console.log(`  Consumo pari al ${n0(frazione * 100)}% delle tue 5 ore più cariche di sempre.`);
    console.log(`  [${barra(frazione)}]`);
    console.log('  In percentuale del limite non si può ancora dire: servono 2 letture di /usage (vedi in fondo).');
  }
  if (dati.finestraPerProgetto.length > 1) {
    const totFin = dati.finestraPerProgetto.reduce((s, p) => s + p.peso, 0) || 1;
    // Le prime tre voci e poi "altri", così la somma fa sempre 100 e nessun
    // progetto sparisce senza dirlo. L'ultima percentuale è il resto delle altre,
    // altrimenti gli arrotondamenti fanno uscire totali tipo 101%.
    const testa = dati.finestraPerProgetto.slice(0, 3);
    const coda = dati.finestraPerProgetto.slice(3);
    const quote = testa.map((p) => Math.round((p.peso / totFin) * 100));
    const voci = testa.map((p, i) => `${p.nostro ? 'questo progetto' : nomeProgettoLeggibile(p.progetto)} ${quote[i]}%`);
    if (coda.length) voci.push(`altri ${coda.length} ${Math.max(0, 100 - quote.reduce((s, q) => s + q, 0))}%`);
    console.log(`  Di chi è questo consumo: ${voci.join(' · ')}`);
  }
  console.log('');

  console.log('GLI AGENTI SI RIPAGANO?');
  if (agenti.quanti === 0) {
    console.log('  Nessun agent usato finora in questo progetto: niente da confrontare.');
  } else {
    // Il team di progetto (esploratore, revisore, architetto) va tenuto distinto
    // dagli agent che Claude Code porta di suo, nei nomi E nei conti: la domanda
    // "teniamo l'esploratore e il revisore?" si decide sul nostro team.
    const elenca = (dentro) =>
      agenti.perTipo
        .filter((t) => TEAM_DI_PROGETTO.includes(t.tipo) === dentro)
        .map((t) => `${t.tipo} ${t.quanti}`)
        .join(', ');

    const bilancio = (titolo, b) => {
      if (b.quanti === 0) return;
      console.log(`  ${titolo}`);
      if (b.conteggiati === 0) {
        console.log(`    nessuna delle ${b.quanti} chiamate è confrontabile (sessioni riprese): niente da dire.`);
        return;
      }
      if (b.esclusi > 0) {
        console.log(
          `    ${b.conteggiati} chiamate su ${b.quanti} si possono contare; le altre ${b.esclusi} stanno in sessioni` +
            ` riprese, che i registri spezzano in due — ${n1(b.costoEsclusi)} unità spese e non confrontabili;`,
        );
      }
      console.log(
        `    hanno letto ${aParole(b.letto)} di token e te ne hanno riportati ${aParole(b.restituito)}:` +
          ` ${aParole(b.tenutoFuori)} non sono mai entrati nella conversazione principale;`,
      );
      console.log(
        `    sono costati ${n1(b.costo)} unità, contro le ${n1(b.costoSeInLinea)} che sarebbero costate a leggerlo tu;`,
      );
      const volte = b.costo > 0 ? b.costoSeInLinea / b.costo : 0;
      if (b.risparmio > 0) {
        console.log(`    → risparmiate fino a ${n1(b.risparmio)} unità, cioè rendono al massimo ${n1(volte)} volte.`);
      } else {
        console.log(`    → bilancio in perdita di ${n1(-b.risparmio)} unità: così non si ripagano.`);
      }
    };

    console.log(`  ${agenti.quanti} chiamate in tutto, dal ${quando(agenti.dal)} a oggi.`);
    bilancio(`Il TEAM DI PROGETTO (${elenca(true)}):`, agenti.team);
    bilancio(`Gli altri agent, quelli di serie (${elenca(false)}):`, agenti.serie);
    console.log('  Attenzione a come si legge: è un TETTO MASSIMO. In conversazione quel testo');
    console.log('  avrebbe fatto scattare la compattazione, che taglia le riletture — quindi');
    console.log('  il verso giusto è "non di più di così".');
    console.log('  Per confrontare due lavori simili: npm run consumi:compito -- "<nome del lavoro>"');
  }
  console.log('');

  console.log("PER FARSI UN'IDEA");
  console.log(
    `  Le tue 5 ore più cariche finora: ${n1(picco.peso)} unità${inLimite(picco.peso)}, il ${quando(picco.quando)}.`,
  );
  console.log(`  Una sessione tipica: ${n1(dati.medianaSessione)} unità${inLimite(dati.medianaSessione)}.`);
  console.log(
    `  L'ultima sessione di questo progetto: ${n1(dati.ultimaSessione.peso)} unità${inLimite(dati.ultimaSessione.peso)}` +
      ` in ${durataAParole(dati.ultimaSessione.fine - dati.ultimaSessione.inizio)}, chiusa ${quando(dati.ultimaSessione.fine)}.`,
  );
  console.log('');

  console.log('DOVE FINISCE IL CONSUMO (da sempre)');
  const voci = [
    ['rileggere quello che è già stato detto', dati.totale.cacheLetta * MOLT_LETTURA_CACHE],
    ['mettere da parte il testo nuovo', dati.totale.cacheScritta * MOLT_SCRITTURA_CACHE],
    ["quello che l'assistente scrive", dati.totale.uscita * 5],
    ['testo entrato senza passare dalla memoria', dati.totale.entrata],
  ];
  const sommaVoci = voci.reduce((s, [, v]) => s + v, 0) || 1;
  for (const [nome, valore] of voci) {
    const q = (valore / sommaVoci) * 100;
    console.log(`  ${nome.padEnd(40)} ${'█'.repeat(Math.round(q / 4)).padEnd(25, ' ')} ${n0(q)}%`);
  }
  console.log('');

  if (opzioni.tecnico) {
    console.log('NUMERI GREZZI');
    console.log(`  sessioni lette: ${dati.sessioni} · chiamate: ${chiamate.length} · dal ${quando(chiamate[0].t)}`);
    console.log(
      `  finestra: peso ${n1(finestra.peso)} · ${finestra.chiamate} chiamate · uscita ${mln(finestra.uscita)} · cache riletta ${mln(finestra.cacheLetta)}`,
    );
    console.log(`  quota del consumo totale finita nei subagent: ${n1(dati.quotaSubagent * 100)}%`);
    if (agenti.quanti > 0) {
      console.log('  ultimi 5 agent:');
      for (const a of agenti.agenti.slice(-5)) {
        // Il risparmio è null per gli agent non abbinati (sessione ripresa):
        // senza questa guardia la stampa moriva a metà.
        const risp = a.abbinato ? n1(a.risparmio) : 'n.d.';
        console.log(
          `    ${a.tipo.padEnd(16)} letto ${String(a.accumulato).padStart(7)} · reso ${String(a.restituito).padStart(6)}` +
            ` · costo ${n1(a.costo).padStart(5)} · risparmio ${risp.padStart(6)} · ${a.descrizione.slice(0, 30)}`,
        );
      }
    }
    console.log('');
  }

  if (!stima) {
    console.log('PER PASSARE ALLE PERCENTUALI');
    console.log("  Il limite dell'abbonamento non è leggibile da qui: nessun comando e nessun");
    console.log('  file locale lo espone. Va letto a mano e registrato, così lo script impara la');
    console.log("  conversione. Come fare, quando la finestra è già carica:");
    console.log('    1. scrivi  /usage  nella casella dell\'app');
    console.log("    2. passa all'assistente la percentuale che riporta");
    console.log(`    3. finisce in ${path.relative(RADICE, FILE_CALIBRAZIONE)}`);
    console.log('  Bastano 3-5 letture prese in momenti di carico diverso.');
    console.log('');
  }
}
