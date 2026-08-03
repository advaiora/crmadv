#!/usr/bin/env node
// Misuratore dei consumi di Claude Code sull'ACCOUNT (tutti i progetti).
//
// A COSA SERVE: su abbonamento (Max 20x) il problema non sono i soldi, e' restare
// dentro la finestra di consumo per non prendere blocchi a meta' lavoro. Questo
// script legge i registri locali che Claude Code scrive per ogni sessione e dice
// quanto si e' consumato: nella finestra di 5 ore in corso, nella sessione, e
// nello storico. E dice se il team di agent si sta ripagando.
//
// PERCHE' TUTTO L'ACCOUNT (deciso il 31/7/2026 con Jacopo): i limiti che /usage
// riporta sono dell'abbonamento intero, non del singolo progetto. Misurare solo
// questa cartella mentre un altro progetto lavora in parallelo accoppierebbe un
// peso parziale a una percentuale totale, falsando la calibrazione. Quindi si
// scansiona ~/.claude/projects per intero.
//
// COSA NON FA: non manda niente da nessuna parte, non tocca il codice del
// progetto, e senza i flag di scrittura non crea alcun file. Legge e stampa.
//
// USO:
//   npm run consumi                              → il quadro in italiano
//   node scripts/agenti/consumi.mjs --json       → stessi dati in JSON
//   node scripts/agenti/consumi.mjs --tecnico    → aggiunge i numeri grezzi
//   node scripts/agenti/consumi.mjs --scrivi     → aggiorna il registro delle rilevazioni
//   npm run consumi:compito -- "spezzatura X"    → annota un pezzo di lavoro concluso
//   ...--compito "X" --da <ora> [--a <ora>]      → delimita il pezzo di lavoro
//   ...--finestra-a "2026-07-31T09:50Z"          → peso di una finestra passata (ricalibrazione)
//
// QUANTO CI METTE: da pochi secondi a una mezza dozzina di decine di secondi,
// secondo quanto e' carica la macchina (misurati 7,6 s e 29,6 s sulla stessa
// cartella). Rilegge tutti i registri di tutti i progetti - decine di migliaia
// di righe - a ogni giro: se sembra fermo, non lo e'.
//
// Nota su "peso": i token non sono tutti uguali (scrivere costa piu' che leggere,
// rileggere la cache costa poco). Il peso li riporta a una scala unica usando i
// prezzi di listino come proporzione. NON e' una bolletta: con l'abbonamento non
// paghi quelle cifre. E' un indicatore di quanto stai consumando la finestra.
//
// COM'E' FATTO (dal 3/8/2026): questo file e' solo l'ingresso — legge gli
// argomenti e decide quale ramo eseguire. Il lavoro sta nei moduli di
// scripts/agenti/consumi/: lettura.mjs (i registri, note #36 e #39),
// raccolta.mjs (il quadro, nota #38), agenti.mjs (il bilancio del team),
// stampa.mjs (i report in italiano), registri.mjs (le scritture su disco).
// Il nome e il percorso di QUESTO file non si cambiano: sono fissati a
// stringa in TRE posti — package.json (consumi, consumi:compito), il
// permesso Bash dell'agent architetto (.claude/agents/architetto.md) e
// l'allowed-tools del comando /handoff (.claude/commands/handoff.md).

import { quando } from './consumi/formattazione.mjs';
import { argomentiValidi, oraIndicata, valoreDi } from './consumi/cli.mjs';
import { raccogli } from './consumi/raccolta.mjs';
import { stampaFinestraPassata, stampaQuadro } from './consumi/stampa.mjs';
import { scriviCompito, scriviRegistro } from './consumi/registri.mjs';

function main() {
  const args = process.argv.slice(2);
  if (!argomentiValidi(args)) {
    process.exitCode = 1;
    return;
  }
  const raccolto = raccogli();
  if (!raccolto) {
    process.exitCode = 1;
    return;
  }
  const { dati, chiamate, adesso } = raccolto;

  if (args.includes('--json')) {
    console.log(JSON.stringify(dati, null, 2));
    return;
  }

  // Peso della finestra di 5 ore che finisce a un'ora passata: serve a RICALCOLARE
  // i campioni di calibrazione quando cambia il modo di pesare (e' successo il
  // 3/8/2026, vedi nota #39). Ora in UTC, formato "2026-07-31T09:50Z".
  const finestraA = valoreDi(args, '--finestra-a');
  if (finestraA) {
    const fine = Date.parse(finestraA);
    if (Number.isNaN(fine)) {
      console.error(`Ora non riconosciuta: "${finestraA}". Attesa una data ISO, es. 2026-07-31T09:50Z`);
      process.exitCode = 1;
      return;
    }
    stampaFinestraPassata(chiamate, fine);
    return;
  }

  const compito = valoreDi(args, '--compito');
  if (compito) {
    // "--da 14:30" limita il conteggio alla parte di sessione da quell'ora in poi
    // (in una sessione si possono chiudere piu' compiti diversi). Con una data
    // intera in "--da"/"--a" si annota invece un lavoro concluso in passato.
    const da = oraIndicata(valoreDi(args, '--da'), adesso);
    const a = oraIndicata(valoreDi(args, '--a'), adesso);
    if (da === undefined || a === undefined) {
      console.error('Ora non riconosciuta: usa "14:30" (oggi) oppure una data intera come "2026-07-31T05:41Z".');
      process.exitCode = 1;
      return;
    }
    if (da !== null && a !== null && a <= da) {
      console.error(`Le due ore sono al contrario: --da ${quando(da)} viene dopo --a ${quando(a)}.`);
      process.exitCode = 1;
      return;
    }
    scriviCompito(compito, dati, chiamate, da, a);
    return;
  }

  stampaQuadro(dati, chiamate, { tecnico: args.includes('--tecnico') });

  if (args.includes('--scrivi')) scriviRegistro(dati, adesso);
}

main();
