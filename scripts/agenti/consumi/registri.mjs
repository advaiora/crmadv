// Le due scritture su disco (spezzato da consumi.mjs il 3/8/2026): il registro
// delle rilevazioni e il registro per compito. ATTENZIONE: i due file markdown
// sono committati e condivisi fra le persone del progetto — il formato delle
// righe e delle intestazioni non si cambia di una virgola, o le righe vecchie
// diventano incoerenti con le nuove.
import fs from 'node:fs';
import path from 'node:path';
import { FILE_COMPITI, FILE_REGISTRO, RADICE } from './config.mjs';
import { durataAParole, n1, quando } from './formattazione.mjs';
import { costoSeFosseInLinea } from './agenti.mjs';

export function scriviRegistro(dati, adesso) {
  fs.mkdirSync(path.dirname(FILE_REGISTRO), { recursive: true });
  const riga =
    `| ${quando(adesso)} | ${n1(dati.ultimaSessione.peso)} | ${dati.ultimaSessione.chiamate} | ${n1(dati.quotaSubagent * 100)}% | ${n1(dati.piccoStorico.peso)} | ${dati.calibrazione} |\n`;
  if (!fs.existsSync(FILE_REGISTRO)) {
    fs.writeFileSync(
      FILE_REGISTRO,
      '# Registro consumi\n\n' +
        '> Aggiornato da `node scripts/agenti/consumi.mjs --scrivi`. Una riga per rilevazione.\n' +
        "> Il \"peso\" e' un indicatore di consumo, non una spesa: con l'abbonamento non si paga a token.\n\n" +
        '| quando | peso ultima sessione | chiamate | quota subagent | picco storico 5h | campioni calibrazione |\n' +
        '|---|---:|---:|---:|---:|---:|\n',
    );
  }
  fs.appendFileSync(FILE_REGISTRO, riga);
  console.log(`Registro aggiornato: ${path.relative(RADICE, FILE_REGISTRO)}`);
  console.log('');
}

// Registro per compito: serve a rispondere alla domanda "conviene chiamare
// l'esploratore?" confrontando lavori SIMILI fra loro (i giri di spezzatura dei
// file, per esempio), non periodi diversi: le sessioni variano troppo per tipo
// di lavoro perche' un confronto a periodo dica qualcosa. Dopo otto-dieci righe
// il quadro si legge da solo.
export function scriviCompito(nome, dati, chiamate, da, a) {
  // Il compito è un pezzo di tempo: per difetto la sessione in corso, ma con
  // --da/--a si annota anche un lavoro concluso in passato (utile per riempire
  // il registro con i giri già fatti). Si conta solo questo progetto, e consumo
  // e risparmio si misurano sullo STESSO pezzo di tempo (vedi sotto).
  const inizio = da ?? dati.ultimaSessione.inizio;
  const limite = a ?? Infinity;
  const dentro = chiamate.filter((c) => c.nostro && c.t >= inizio && c.t <= limite);
  if (dentro.length === 0) {
    console.error(
      `Nessuna chiamata di questo progetto fra ${quando(inizio)} e ${a ? quando(limite) : 'adesso'}: niente da annotare.`,
    );
    console.error('Controlla le ore: sono quelle del computer, non UTC.');
    process.exitCode = 1;
    return;
  }
  const consumo = dentro.reduce((s, c) => s + c.peso, 0);
  const fine = dentro[dentro.length - 1].t;
  const agentiQui = dati.agenti.agenti.filter((x) => x.inizio >= inizio && x.inizio <= limite);
  const conteggio = new Map();
  for (const x of agentiQui) conteggio.set(x.tipo, (conteggio.get(x.tipo) || 0) + 1);
  const elencoAgenti = agentiQui.length
    ? [...conteggio.entries()].map(([t, q]) => `${t}×${q}`).join(', ')
    : 'nessuno';
  // Il risparmio va ricalcolato DENTRO la finestra del compito: quello globale
  // conta anche le riletture avvenute nei compiti successivi, e messo accanto a
  // un consumo ritagliato su 47 minuti farebbe sembrare l'agent piu' conveniente
  // di quanto sia. Le due colonne devono avere lo stesso perimetro.
  const conteggiabili = agentiQui.filter((x) => x.abbinato);
  const risparmio = conteggiabili.reduce((s, x) => {
    const dopo = chiamate.filter((c) => !c.subagent && c.sessione === x.sessione && c.t > x.fine && c.t <= limite);
    return s + costoSeFosseInLinea(x.tenutoFuori, dopo, x.modelloPrincipale) - x.costo;
  }, 0);
  const fuoriConto = agentiQui.length - conteggiabili.length;

  fs.mkdirSync(path.dirname(FILE_COMPITI), { recursive: true });
  if (!fs.existsSync(FILE_COMPITI)) {
    fs.writeFileSync(
      FILE_COMPITI,
      '# Registro per compito\n\n' +
        '> Una riga per ogni pezzo di lavoro concluso, scritta da `npm run consumi:compito -- "<nome>"`.\n' +
        "> Per default conta la sessione in corso; con `--da 10:30` si parte da un'ora precisa, e con\n" +
        '> `--da "2026-07-31T07:40Z" --a "2026-07-31T08:26Z"` si annota un lavoro già concluso.\n' +
        '>\n' +
        '> **A cosa serve:** confrontare lavori SIMILI fra loro — per esempio i giri di spezzatura\n' +
        "> dei file-mostro — per capire se chiamare l'esploratore conviene. Non serve un periodo\n" +
        '> "senza agenti": le sessioni variano troppo per tipo di lavoro, la differenza sparirebbe\n' +
        '> nel rumore. Si confronta a parità di compito.\n' +
        '>\n' +
        "> Il consumo è in \"unità\": un indicatore di quanto si è mangiato della finestra, non una spesa.\n" +
        '> Le ore sono quelle del computer. Consumo e risparmio sono misurati sullo **stesso pezzo di\n' +
        '> tempo**: il risparmio di un agent chiamato a fine compito risulta quindi piccolo o negativo,\n' +
        '> perché le riletture che avrebbe evitato cadono nel compito dopo. Vale soprattutto per il\n' +
        '> revisore, che per contratto si chiama in chiusura — e che comunque non si tiene per far\n' +
        '> risparmiare token, ma per trovare errori.\n\n' +
        '| quando | compito | durata | consumo | agenti usati | risparmio agenti |\n' +
        '|---|---|---:|---:|---|---:|\n',
    );
  }
  const risparmioDetto = conteggiabili.length ? n1(risparmio) : '—';
  const riga = `| ${quando(fine)} | ${nome.replace(/\|/g, '/')} | ${durataAParole(fine - inizio)} | ${n1(consumo)} | ${elencoAgenti} | ${risparmioDetto} |\n`;
  fs.appendFileSync(FILE_COMPITI, riga);

  console.log('');
  console.log(`Annotato in ${path.relative(RADICE, FILE_COMPITI)}:`);
  console.log(`  compito  : ${nome}`);
  console.log(`  durata   : ${durataAParole(fine - inizio)}`);
  console.log(`  consumo  : ${n1(consumo)} unità (${dentro.length} chiamate)`);
  console.log(`  agenti   : ${elencoAgenti}`);
  if (conteggiabili.length) console.log(`  risparmio: ${n1(risparmio)} unità`);
  if (fuoriConto > 0) {
    console.log(`  ATTENZIONE: ${fuoriConto} agent fuori dal conto (sessione ripresa, registri spezzati).`);
  }
  console.log('');
}
