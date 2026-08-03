#!/usr/bin/env node
// Misuratore dei consumi di Claude Code sull'ACCOUNT (tutti i progetti).
//
// A COSA SERVE: su abbonamento (MAX 5x) il problema non sono i soldi, e' restare
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

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const FINESTRA_MS = 5 * 60 * 60 * 1000; // la finestra di consumo e' di 5 ore

// Prezzi di listino per milione di token, verificati il 23/7/2026.
// Servono solo come PROPORZIONE fra i tipi di token. Se cambiano, si aggiorna qui.
const PREZZI = {
  'claude-opus-5': { in: 5, out: 25 }, // assunto pari a Opus 4.x finche' non verificato a listino
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-opus-4-7': { in: 5, out: 25 },
  'claude-opus-4-6': { in: 5, out: 25 },
  'claude-fable-5': { in: 10, out: 50 },
  'claude-sonnet-5': { in: 3, out: 15 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};
const PREZZO_IGNOTO = { in: 5, out: 25 }; // se esce un modello nuovo, si assume Opus
const MOLT_SCRITTURA_CACHE = 2; // cache tenuta 1 ora: costa il doppio dell'ingresso
const MOLT_LETTURA_CACHE = 0.1; // rileggere la cache costa un decimo

// Gli agent scritti per questo progetto (.claude/agents/). Gli altri nomi che
// compaiono nei registri sono gli agent di serie di Claude Code.
const TEAM_DI_PROGETTO = ['esploratore', 'revisore', 'architetto'];

const RADICE = process.cwd();
const FILE_CALIBRAZIONE = path.join(RADICE, 'archivio-documenti', 'consumi', 'calibrazione.json');
const FILE_REGISTRO = path.join(RADICE, 'archivio-documenti', 'consumi', 'registro.md');
const FILE_COMPITI = path.join(RADICE, 'archivio-documenti', 'consumi', 'registro-compiti.md');

// I nomi delle cartelle dei registri sono il percorso del progetto con i
// separatori sostituiti da trattini: si accorciano per renderli leggibili.
function nomeProgettoLeggibile(cartella) {
  return cartella.replace(/^[A-Za-z]--Users-[^-]+-Documents-/, '').replace(/^[A-Za-z]--/, '');
}

// Il modello nei registri puo' avere il suffisso della data
// (es. "claude-haiku-4-5-20251001"): si cerca la chiave di listino piu' lunga
// di cui il modello e' il prolungamento. Senza questo, un modello datato
// finirebbe sul prezzo di ripiego (Opus) e peserebbe fino a 5 volte il vero.
function prezzoDi(modello) {
  if (!modello) return PREZZO_IGNOTO;
  if (PREZZI[modello]) return PREZZI[modello];
  let miglior = null;
  for (const chiave of Object.keys(PREZZI)) {
    if (modello.startsWith(chiave) && (!miglior || chiave.length > miglior.length)) miglior = chiave;
  }
  return miglior ? PREZZI[miglior] : PREZZO_IGNOTO;
}

// --- individua le cartelle dei registri --------------------------------------

// Radice di TUTTI i progetti: e' quella che si misura, perche' il limite
// dell'abbonamento e' unico per l'account (vedi nota in testa al file).
function cartellaTuttiProgetti() {
  const base = path.join(os.homedir(), '.claude', 'projects');
  return fs.existsSync(base) ? base : null;
}

// Cartella del SOLO progetto corrente: serve a etichettare le chiamate
// (quanto di questa finestra e' nostro e quanto degli altri progetti).
// Attenzione: su Windows fs.existsSync ignora le maiuscole, quindi il percorso
// "atteso" puo' risultare esistente pur essendo scritto diversamente da come
// sta sul disco. Si restituisce sempre il nome REALE letto dalla cartella,
// altrimenti il confronto per prefisso piu' avanti non combacia e il proprio
// progetto risulta "di qualcun altro".
function cartellaRegistri() {
  const base = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(base)) return null;

  const atteso = RADICE.replace(/[\\/:]/g, '-');
  let voci;
  try {
    voci = fs.readdirSync(base);
  } catch {
    return null;
  }
  const combacia = voci.find((n) => n.toLowerCase() === atteso.toLowerCase());
  if (combacia) return path.join(base, combacia);

  // Ripiego: la regola di conversione del nome puo' cambiare, ma dentro i
  // registri c'e' scritta la cartella di lavoro. Si cerca quella.
  for (const nome of voci) {
    const dir = path.join(base, nome);
    if (!fs.statSync(dir).isDirectory()) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    if (files.length === 0) continue;
    try {
      const righe = fs.readFileSync(path.join(dir, files[0]), 'utf8').split('\n');
      for (const riga of righe) {
        if (!riga.trim()) continue;
        const j = JSON.parse(riga);
        if (typeof j.cwd === 'string' && j.cwd.toLowerCase() === RADICE.toLowerCase()) return dir;
        break;
      }
    } catch {
      /* registro illeggibile: si passa oltre */
    }
  }
  return null;
}

// --- lettura e normalizzazione ----------------------------------------------

function peso(uso, modello) {
  const p = prezzoDi(modello);
  const inTok = uso.input_tokens || 0;
  const outTok = uso.output_tokens || 0;
  const scrittura = uso.cache_creation_input_tokens || 0;
  const lettura = uso.cache_read_input_tokens || 0;
  return (
    (inTok * p.in +
      outTok * p.out +
      scrittura * p.in * MOLT_SCRITTURA_CACHE +
      lettura * p.in * MOLT_LETTURA_CACHE) /
    1e6
  );
}

// Elenca ricorsivamente tutti i .jsonl sotto una cartella. Serve perche' Claude
// Code usa un layout a cartelle-per-sessione: il transcript principale sta in
// <progetto>/<sessione>.jsonl, ma le chiamate dei subagent finiscono in
// <progetto>/<sessione>/subagents/*.jsonl. Leggendo solo il primo livello si
// perdevano TUTTI i subagent: quota subagent falsata a 0 e totale sottostimato.
function elencaJsonl(base) {
  const out = [];
  let voci;
  try {
    voci = fs.readdirSync(base);
  } catch {
    return out;
  }
  for (const nome of voci) {
    const p = path.join(base, nome);
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...elencaJsonl(p));
    else if (nome.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

function leggiChiamate(base, dirProgettoCorrente = null) {
  // Una sola chiamata al modello viene annotata su PIU' righe del registro (il
  // ragionamento, l'uso di uno strumento, la risposta finale), tutte con lo
  // stesso requestId e con i contatori che crescono riga dopo riga. Vanno quindi
  // fuse tenendo il valore massimo: fermarsi alla prima riga - come si faceva
  // fino al 3/8/2026 - sottostimava del 12% i token scritti dall'assistente,
  // che sono la voce piu' cara, e riduceva a 2-3 token la risposta finale degli
  // agent (che e' proprio il numero da confrontare col loro costo).
  const perChiamata = new Map();
  const lanci = new Map(); // id della chiamata Agent -> tipo, descrizione, sessione, ora
  const tipiAgente = new Map(); // identificativo del subagent -> tipo e descrizione
  const testoFinale = new Map(); // identificativo del subagent -> lunghezza della risposta finale
  const prefissoNostro = dirProgettoCorrente ? dirProgettoCorrente.toLowerCase() + path.sep : null;
  for (const file of elencaJsonl(base)) {
    // A quale progetto appartiene questa chiamata: la prima parte del percorso
    // relativo alla radice dei progetti e' la cartella-progetto.
    const progetto = path.relative(base, file).split(path.sep)[0] || '(radice)';
    const nostro = prefissoNostro ? file.toLowerCase().startsWith(prefissoNostro) : true;
    let contenuto;
    try {
      contenuto = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Se il file sta in .../<sessione>/subagents/..., il consumo va attribuito
    // alla sessione che ha lanciato il subagent (la cartella nonna), e la riga
    // va marcata come subagent anche se il flag isSidechain non fosse presente.
    const parti = path.relative(base, file).split(path.sep);
    const iSub = parti.indexOf('subagents');
    const sessioneMadre = iSub > 0 ? parti[iSub - 1] : null;
    const nomeBase = path.basename(file).replace('.jsonl', '');
    // Nome del file di un subagent: "agent-<identificativo>". E' la chiave che
    // lo lega alla chiamata Agent annotata nel transcript principale.
    const agente = iSub > 0 ? nomeBase.replace(/^agent-/, '') : null;
    for (const riga of contenuto.split('\n')) {
      if (!riga.trim()) continue;
      let j;
      try {
        j = JSON.parse(riga);
      } catch {
        continue;
      }
      const m = j.message;
      if (!m) continue;
      // Nel transcript principale la chiamata Agent porta il TIPO di agent
      // (esploratore, revisore, ...) e la sua risposta contiene l'identificativo
      // del subagent: è l'unico punto in cui i due si toccano.
      if (iSub < 0 && Array.isArray(m.content)) {
        for (const b of m.content) {
          if (b.type === 'tool_use' && (b.name === 'Agent' || b.name === 'Task')) {
            lanci.set(b.id, {
              tipo: (b.input && b.input.subagent_type) || 'senza tipo',
              descrizione: (b.input && b.input.description) || '',
              sessione: j.sessionId || nomeBase,
              t: Date.parse(j.timestamp || 0) || 0,
              abbinato: false,
            });
          } else if (b.type === 'tool_result' && lanci.has(b.tool_use_id)) {
            const testo = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
            const trovato = /agentId:\s*([A-Za-z0-9_-]+)/.exec(testo);
            if (trovato) {
              const lancio = lanci.get(b.tool_use_id);
              lancio.abbinato = true;
              tipiAgente.set(trovato[1], lancio);
            }
          }
        }
      }
      // Quanto ha riportato indietro l'agent. Nei registri il conteggio dei token
      // della risposta finale a volte resta fermo a 2-3 (la riga non viene
      // aggiornata a fine risposta), quindi si tiene anche la lunghezza del testo
      // come misura di riserva: senza, il "restituito" risulterebbe quasi zero e
      // il risparmio verrebbe gonfiato.
      if (agente && m.role === 'assistant' && Array.isArray(m.content) && j.timestamp) {
        const car = m.content.reduce((s, b) => s + (b.type === 'text' ? (b.text || '').length : 0), 0);
        if (car > 0) {
          const t = Date.parse(j.timestamp);
          const gia = testoFinale.get(agente);
          if (!gia || t >= gia.t) testoFinale.set(agente, { t, car });
        }
      }
      if (!m.usage || !j.timestamp) continue;
      const chiave = j.requestId || j.uuid;
      if (!chiave) continue;
      const u = m.usage;
      const gia = perChiamata.get(chiave);
      if (gia) {
        gia.t = Math.max(gia.t, Date.parse(j.timestamp));
        gia.entrata = Math.max(gia.entrata, u.input_tokens || 0);
        gia.uscita = Math.max(gia.uscita, u.output_tokens || 0);
        gia.cacheScritta = Math.max(gia.cacheScritta, u.cache_creation_input_tokens || 0);
        gia.cacheLetta = Math.max(gia.cacheLetta, u.cache_read_input_tokens || 0);
        continue;
      }
      perChiamata.set(chiave, {
        t: Date.parse(j.timestamp),
        sessione: sessioneMadre || j.sessionId || nomeBase,
        progetto,
        nostro,
        modello: m.model || 'sconosciuto',
        subagent: Boolean(j.isSidechain) || iSub > 0,
        agente,
        entrata: u.input_tokens || 0,
        uscita: u.output_tokens || 0,
        cacheScritta: u.cache_creation_input_tokens || 0,
        cacheLetta: u.cache_read_input_tokens || 0,
      });
    }
  }
  const chiamate = [...perChiamata.values()].map((c) => ({
    ...c,
    // Quanto testo aveva davanti il modello a questa chiamata: e' la misura
    // di quanto "pesa" la conversazione in quel momento.
    contesto: c.entrata + c.cacheScritta + c.cacheLetta,
    peso: peso(
      {
        input_tokens: c.entrata,
        output_tokens: c.uscita,
        cache_creation_input_tokens: c.cacheScritta,
        cache_read_input_tokens: c.cacheLetta,
      },
      c.modello,
    ),
  }));
  chiamate.sort((a, b) => a.t - b.t);
  return { chiamate, tipiAgente, lanci, testoFinale };
}

// Ripiego per riconoscere gli agent che la risposta della chiamata non identifica
// (succede con le versioni piu' vecchie di Claude Code, dove il risultato era il
// rapporto dell'agent e non conteneva l'identificativo). Dentro una stessa
// sessione si accoppiano in ordine di tempo le chiamate rimaste spaiate con gli
// agent rimasti senza tipo: e' l'unico ordine possibile, visto che partono e
// finiscono in sequenza.
function abbinaPerOrdine(agentiSenzaTipo, lanci) {
  const spaiati = new Map();
  for (const l of lanci.values()) {
    if (l.abbinato) continue;
    if (!spaiati.has(l.sessione)) spaiati.set(l.sessione, []);
    spaiati.get(l.sessione).push(l);
  }
  for (const elenco of spaiati.values()) elenco.sort((a, b) => a.t - b.t);

  const perSessione = new Map();
  for (const a of agentiSenzaTipo) {
    if (!perSessione.has(a.sessione)) perSessione.set(a.sessione, []);
    perSessione.get(a.sessione).push(a);
  }
  const abbinamenti = new Map();
  for (const [sessione, elenco] of perSessione) {
    const candidati = spaiati.get(sessione) || [];
    elenco.sort((a, b) => a.inizio - b.inizio);
    for (let i = 0; i < elenco.length && i < candidati.length; i += 1) {
      abbinamenti.set(elenco[i].id, candidati[i]);
    }
  }
  return abbinamenti;
}

// --- aggregazioni ------------------------------------------------------------

function sommaVuota() {
  return { peso: 0, entrata: 0, uscita: 0, cacheScritta: 0, cacheLetta: 0, chiamate: 0 };
}
function accumula(acc, c) {
  acc.peso += c.peso;
  acc.entrata += c.entrata;
  acc.uscita += c.uscita;
  acc.cacheScritta += c.cacheScritta;
  acc.cacheLetta += c.cacheLetta;
  acc.chiamate += 1;
  return acc;
}

function piccoFinestra(chiamate) {
  let migliore = 0;
  let quando = 0;
  let somma = 0;
  let coda = 0;
  for (let i = 0; i < chiamate.length; i += 1) {
    somma += chiamate[i].peso;
    while (chiamate[coda].t < chiamate[i].t - FINESTRA_MS) {
      somma -= chiamate[coda].peso;
      coda += 1;
    }
    if (somma > migliore) {
      migliore = somma;
      quando = chiamate[i].t;
    }
  }
  return { peso: migliore, quando };
}

function perSessione(chiamate) {
  const mappa = new Map();
  for (const c of chiamate) {
    if (!mappa.has(c.sessione)) {
      mappa.set(c.sessione, { id: c.sessione, inizio: c.t, fine: c.t, ...sommaVuota(), subagent: 0 });
    }
    const s = mappa.get(c.sessione);
    accumula(s, c);
    s.fine = Math.max(s.fine, c.t);
    s.inizio = Math.min(s.inizio, c.t);
    if (c.subagent) s.subagent += c.peso;
  }
  return [...mappa.values()].sort((a, b) => a.fine - b.fine);
}

function mediana(valori) {
  if (valori.length === 0) return 0;
  const v = [...valori].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

// --- il conto degli agent ----------------------------------------------------
// La domanda a cui deve rispondere: il team di agent ci fa risparmiare, e quanto?
//
// COME SI CALCOLA (niente stime a occhio, sono tutti numeri presi dai registri):
// un agent legge file e ragiona in una conversazione SUA, e alla fine riporta
// poche righe. Quello che ha letto - la crescita del suo contesto - se il lavoro
// lo avessi fatto nella conversazione principale ci sarebbe rimasto dentro: una
// volta per metterlo in memoria (cache) e poi RILETTO a ogni risposta successiva
// fino a fine sessione. E' quel conto ripetuto che si risparmia, non solo la
// lettura singola.
//
// ATTENZIONE, il conto tira in due direzioni opposte e va letto come un MASSIMO,
// non come un pavimento:
//  - verso il basso: la memoria in realta' si riscrive piu' volte in una sessione
//    lunga, qui se ne conta una sola;
//  - verso l'alto, e pesa di piu': in linea quel testo avrebbe fatto scattare la
//    compattazione della conversazione, che taglia le riletture. Il grosso del
//    risparmio viene proprio dagli agent seguiti da centinaia di risposte, cioe'
//    dai casi in cui la compattazione sarebbe intervenuta di sicuro.
// Quindi il risparmio stampato e' il tetto massimo, non il valore atteso.

// Quanto sarebbe costato tenersi in conversazione un testo di `tenutoFuori` token:
// una scrittura in memoria (che si paga comunque, appena il testo entra) piu' una
// rilettura per ogni risposta arrivata dopo.
function costoSeFosseInLinea(tenutoFuori, dopo, modelloRipiego) {
  if (tenutoFuori <= 0) return 0;
  const primo = prezzoDi(dopo.length > 0 ? dopo[0].modello : modelloRipiego);
  let costo = (tenutoFuori * primo.in * MOLT_SCRITTURA_CACHE) / 1e6;
  for (const c of dopo) costo += (tenutoFuori * prezzoDi(c.modello).in * MOLT_LETTURA_CACHE) / 1e6;
  return costo;
}

function analizzaAgenti(chiamate, { tipiAgente, lanci, testoFinale }, soloNostro) {
  // Chiamate della conversazione principale, raggruppate per sessione: servono
  // a contare quante volte quel testo sarebbe stato riletto.
  const principaliPerSessione = new Map();
  for (const c of chiamate) {
    if (c.subagent) continue;
    if (!principaliPerSessione.has(c.sessione)) principaliPerSessione.set(c.sessione, []);
    principaliPerSessione.get(c.sessione).push(c);
  }

  const perAgente = new Map();
  for (const c of chiamate) {
    if (!c.agente) continue;
    if (soloNostro && !c.nostro) continue;
    if (!perAgente.has(c.agente)) {
      perAgente.set(c.agente, {
        id: c.agente,
        sessione: c.sessione,
        progetto: c.progetto,
        modello: c.modello,
        inizio: c.t,
        fine: c.t,
        chiamate: 0,
        costo: 0,
        contestoIniziale: c.contesto,
        contestoPicco: c.contesto,
        restituito: 0,
      });
    }
    const a = perAgente.get(c.agente);
    a.chiamate += 1;
    a.costo += c.peso;
    a.fine = Math.max(a.fine, c.t);
    a.contestoPicco = Math.max(a.contestoPicco, c.contesto);
    a.restituito = c.uscita; // l'ultima chiamata in ordine di tempo e' la risposta finale
  }

  const senzaTipo = [...perAgente.values()].filter((a) => !tipiAgente.get(a.id));
  const ripiego = abbinaPerOrdine(senzaTipo, lanci);

  const agenti = [];
  for (const a of perAgente.values()) {
    const tipo = tipiAgente.get(a.id) || ripiego.get(a.id);
    // Il conteggio dei token della risposta finale a volte manca nei registri:
    // in quel caso vale la stima dalla lunghezza del testo (4 caratteri = 1 token).
    const daTesto = testoFinale.get(a.id);
    const restituito = Math.max(a.restituito, daTesto ? Math.round(daTesto.car / 4) : 0);
    // Quello che l'agent ha accumulato leggendo, meno quello che ha riportato
    // indietro: e' il testo che NON e' mai entrato nella conversazione principale.
    const accumulato = Math.max(0, a.contestoPicco - a.contestoIniziale);
    const tenutoFuori = Math.max(0, accumulato - restituito);
    const principali = principaliPerSessione.get(a.sessione) || [];
    const dopo = principali.filter((c) => c.t > a.fine);
    // Se della sessione madre non risulta NESSUNA chiamata principale, il conto
    // non si può fare: non è un agent chiamato in chiusura, è una sessione che i
    // registri non ricongiungono (quando una chat viene ripresa, Claude Code la
    // riscrive in un file nuovo con un identificativo diverso, e le chiamate
    // finiscono attribuite altrove). Meglio dichiararlo che stampare una perdita
    // inventata: sono casi da non contare, non casi negativi.
    const abbinato = principali.length > 0;
    // Il controfattuale è "se lo avessi letto io": va pesato col modello della
    // conversazione PRINCIPALE, non con quello dell'agent (spesso diversi, e la
    // differenza di listino arriva a 3 volte).
    const prima = principali.filter((c) => c.t < a.inizio);
    const modelloPrincipale = prima.length > 0 ? prima[prima.length - 1].modello : a.modello;
    const costoSeInLinea = abbinato ? costoSeFosseInLinea(tenutoFuori, dopo, modelloPrincipale) : null;
    agenti.push({
      ...a,
      tipo: tipo ? tipo.tipo : 'non identificato',
      descrizione: tipo ? tipo.descrizione : '',
      restituito,
      accumulato,
      tenutoFuori,
      abbinato,
      modelloPrincipale,
      rispostePoi: dopo.length,
      costoSeInLinea,
      risparmio: abbinato ? costoSeInLinea - a.costo : null,
    });
  }
  agenti.sort((a, b) => a.inizio - b.inizio);

  // Il bilancio si fa a gruppi: la domanda "conviene tenere l'esploratore e il
  // revisore?" si decide sui NOSTRI agent, non mescolandoli con quelli di serie
  // di Claude Code, che hanno un'economia diversa.
  const bilancio = (elenco) => {
    const buoni = elenco.filter((a) => a.abbinato);
    const fuori = elenco.filter((a) => !a.abbinato);
    const s = (k) => buoni.reduce((tot, a) => tot + a[k], 0);
    return {
      quanti: elenco.length,
      conteggiati: buoni.length,
      esclusi: fuori.length,
      costoEsclusi: fuori.reduce((tot, a) => tot + a.costo, 0),
      costo: s('costo'),
      letto: s('accumulato'),
      restituito: s('restituito'),
      tenutoFuori: s('tenutoFuori'),
      costoSeInLinea: s('costoSeInLinea'),
      risparmio: s('risparmio'),
    };
  };

  const perTipo = new Map();
  for (const a of agenti) {
    const v = perTipo.get(a.tipo) || { tipo: a.tipo, quanti: 0 };
    v.quanti += 1;
    perTipo.set(a.tipo, v);
  }

  const delTeam = agenti.filter((a) => TEAM_DI_PROGETTO.includes(a.tipo));
  const diSerie = agenti.filter((a) => !TEAM_DI_PROGETTO.includes(a.tipo));

  return {
    agenti,
    quanti: agenti.length,
    nonConteggiati: agenti.filter((a) => !a.abbinato).length,
    dal: agenti.length ? agenti[0].inizio : null,
    team: bilancio(delTeam),
    serie: bilancio(diSerie),
    tutti: bilancio(agenti),
    perTipo: [...perTipo.values()].sort((a, b) => b.quanti - a.quanti),
  };
}

// --- calibrazione ------------------------------------------------------------
// Il rapporto fra "peso" e percentuale reale del limite non e' pubblicato e non
// e' leggibile da nessuna parte in locale. Si impara dai campioni che l'utente
// fornisce leggendo /usage nell'app.

function leggiCalibrazione() {
  try {
    const j = JSON.parse(fs.readFileSync(FILE_CALIBRAZIONE, 'utf8'));
    // I campioni marcati "escluso" restano nel file come memoria storica ma
    // non entrano nella stima (di solito: presi con un metro non confrontabile).
    return Array.isArray(j.campioni) ? j.campioni.filter((c) => c.peso > 0 && c.percentuale > 0 && !c.escluso) : [];
  } catch {
    return [];
  }
}

function stimaPercentuale(campioni, pesoAttuale) {
  if (campioni.length < 2) return null;
  // Retta per l'origine: percentuale = k * peso. k = media dei rapporti.
  const k = campioni.reduce((s, c) => s + c.percentuale / c.peso, 0) / campioni.length;
  const scarti = campioni.map((c) => Math.abs(c.percentuale - k * c.peso));
  return {
    k, // quanto limite consuma un'unità di peso: serve a tradurre qualsiasi peso in percentuale
    percentuale: k * pesoAttuale,
    campioni: campioni.length,
    scartoMedio: scarti.reduce((s, x) => s + x, 0) / scarti.length,
  };
}

// --- come si raccontano i numeri ---------------------------------------------

// I decimali si scrivono con la virgola: e' un report in italiano.
const n1 = (x) => x.toFixed(1).replace('.', ',');
const n0 = (x) => x.toFixed(0);
const mln = (x) => `${(x / 1e6).toFixed(2).replace('.', ',')}M`;
// Le ore si stampano nell'ORA DEL COMPUTER, non in UTC: chi rilegge il registro
// deve poterle confrontare con l'ora dei commit e con la propria giornata. (Prima
// uscivano in UTC senza dirlo, e le righe risultavano indietro di due ore.)
function quando(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Numeri grossi detti a parole, come si direbbe parlando. L'unita' di misura
// ("token") la mette la frase una volta sola, non ogni numero.
function aParole(tok) {
  if (tok >= 1e6) return `${n1(tok / 1e6)} milioni`;
  if (tok >= 1000) return `${Math.round(tok / 1000)} mila`;
  return String(tok);
}

function durataAParole(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}

// A che punto sei della finestra, detto in modo utile per decidere se attaccare
// un lavoro grosso o chiudere bottega.
function comeSiamoMessi(percentuale) {
  if (percentuale < 15) return 'La finestra è quasi intatta, puoi attaccare un lavoro grosso.';
  if (percentuale < 40) return "Sei intorno a un terzo: c'è spazio per un pezzo di lavoro intero.";
  if (percentuale < 60) return 'Sei circa a metà: un altro pezzo ci sta, uno lungo forse no.';
  if (percentuale < 80) return 'Hai passato i due terzi, conviene chiudere quello che è già aperto.';
  return 'Sei vicino al limite: meglio non iniziare niente di lungo, si rischia il blocco a metà lavoro.';
}

// "il 5%" ma "l'8%": l'articolo si elide davanti ai numeri che in italiano
// iniziano per vocale — uno, otto, undici, ottanta e i suoi (ottantuno...).
function ilPerCento(x) {
  const v = Math.round(x);
  if (x > 0 && v === 0) return "meno dell'1%";
  const elide = v === 1 || v === 8 || v === 11 || (v >= 80 && v <= 89);
  return `${elide ? "l'" : 'il '}${v}%`;
}

function barra(frazione, larghezza = 40) {
  const pieni = Math.max(0, Math.min(larghezza, Math.round(frazione * larghezza)));
  return '#'.repeat(pieni).padEnd(larghezza, '.');
}

// --- il quadro ---------------------------------------------------------------

function raccogli() {
  const base = cartellaTuttiProgetti();
  if (!base) {
    console.error('Registri di Claude Code non trovati.');
    console.error(`Cercati in: ${path.join(os.homedir(), '.claude', 'projects')}`);
    return null;
  }
  const dirNostra = cartellaRegistri(); // puo' essere null: si misura comunque l'account

  const { chiamate, ...anagrafica } = leggiChiamate(base, dirNostra);
  if (chiamate.length === 0) {
    console.error("Nessuna chiamata registrata: non c'e' ancora niente da misurare.");
    return null;
  }

  const adesso = Date.now();
  const inFinestra = chiamate.filter((c) => c.t >= adesso - FINESTRA_MS);
  const finestra = inFinestra.reduce(accumula, sommaVuota());
  // Ripartizione della finestra per progetto: serve a capire quanto del limite
  // se lo sta mangiando un altro progetto aperto in parallelo.
  const finestraPerProgetto = [
    ...inFinestra
      .reduce((mappa, c) => {
        const voce = mappa.get(c.progetto) || { progetto: c.progetto, peso: 0, nostro: c.nostro };
        voce.peso += c.peso;
        mappa.set(c.progetto, voce);
        return mappa;
      }, new Map())
      .values(),
  ].sort((a, b) => b.peso - a.peso);
  const totale = chiamate.reduce(accumula, sommaVuota());
  const picco = piccoFinestra(chiamate);
  const sessioni = perSessione(chiamate);
  const medianaSessione = mediana(sessioni.map((s) => s.peso));
  const pesoSubagent = chiamate.filter((c) => c.subagent).reduce((s, c) => s + c.peso, 0);
  const campioni = leggiCalibrazione();
  const stima = stimaPercentuale(campioni, finestra.peso);
  // Il conto degli agent si fa su QUESTO progetto: il team è nostro, e mischiarlo
  // con gli agent di altri progetti renderebbe il bilancio illeggibile.
  const agenti = analizzaAgenti(chiamate, anagrafica, Boolean(dirNostra));
  // La sessione in corso è l'ultima di questo progetto (non dell'account).
  const sessioniNostre = perSessione(chiamate.filter((c) => c.nostro));
  const ultima = sessioniNostre[sessioniNostre.length - 1] || sessioni[sessioni.length - 1];

  return {
    adesso,
    chiamate,
    dati: {
      generatoIl: new Date(adesso).toISOString(),
      finestraCorrente: { ...finestra, stimaPercentuale: stima },
      piccoStorico: picco,
      medianaSessione,
      ultimaSessione: ultima,
      totale,
      sessioni: sessioni.length,
      quotaSubagent: totale.peso > 0 ? pesoSubagent / totale.peso : 0,
      calibrazione: campioni.length,
      finestraPerProgetto,
      agenti,
    },
  };
}

function stampaQuadro(dati, chiamate, opzioni) {
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

// --- registro delle rilevazioni ----------------------------------------------

function scriviRegistro(dati, adesso) {
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

// --- registro per compito ----------------------------------------------------
// Serve a rispondere alla domanda "conviene chiamare l'esploratore?" confrontando
// lavori SIMILI fra loro (i giri di spezzatura dei file, per esempio), non periodi
// diversi: le sessioni variano troppo per tipo di lavoro perche' un confronto a
// periodo dica qualcosa. Dopo otto-dieci righe il quadro si legge da solo.
function scriviCompito(nome, dati, chiamate, da, a) {
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

// --- avvio -------------------------------------------------------------------

// Torna il valore di un'opzione, `null` se l'opzione non e' stata usata,
// `undefined` se e' stata usata senza valore. Distinguere i due casi serve: un
// "--da" senza ora, trattato come "non chiesto", annotava di nascosto l'intera
// sessione invece del pezzo voluto.
function valoreDi(args, nome) {
  const i = args.indexOf(nome);
  if (i < 0) return null;
  const dopo = args[i + 1];
  return dopo && !dopo.startsWith('--') ? dopo : undefined;
}

// Controlla che ogni opzione usata abbia il suo valore. Torna il nome della
// prima incompleta, o null se va tutto bene.
function opzioneSenzaValore(args, nomi) {
  return nomi.find((n) => args.includes(n) && valoreDi(args, n) === undefined) || null;
}

// Accetta "14:30" (oggi, ora del computer) o una data intera ISO. Torna null se
// non e' stato chiesto niente, undefined se il testo non si capisce.
function oraIndicata(testo, adesso) {
  if (!testo) return null;
  if (/^\d{1,2}:\d{2}$/.test(testo)) {
    const [h, m] = testo.split(':').map(Number);
    if (h > 23 || m > 59) return undefined; // "99:99" non e' un'ora
    const d = new Date(adesso);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }
  const t = Date.parse(testo);
  return Number.isNaN(t) ? undefined : t;
}

// Tutti i controlli sugli argomenti, PRIMA di leggere i registri: leggerli costa
// una ventina di secondi, e non ha senso spenderli per poi dire che il comando
// era scritto male. Torna false se c'e' qualcosa che non va (dopo aver spiegato
// cosa), true se si puo' procedere.
function argomentiValidi(args) {
  // Un'opzione scritta senza il suo valore veniva ignorata in silenzio, e il
  // comando faceva un'altra cosa senza dirlo: e' esattamente il tipo di errore
  // muto che questo strumento serve a scovare, quindi qui si ferma.
  const esempi = {
    '--compito': 'npm run consumi:compito -- "spezzatura ClientsList, giro 2"',
    '--da': '--da 10:30   oppure   --da "2026-07-31T07:40Z"',
    '--a': '--a 11:15    oppure   --a "2026-07-31T08:26Z"',
    '--finestra-a': '--finestra-a "2026-07-31T09:50Z"',
  };
  const monca = opzioneSenzaValore(args, Object.keys(esempi));
  if (monca) {
    console.error(`Manca il valore di ${monca}. Esempio: ${esempi[monca]}`);
    return false;
  }
  // --da/--a delimitano un compito: da soli non vogliono dire niente, e prima
  // venivano ignorati senza un fiato.
  const solitari = ['--da', '--a'].filter((n) => args.includes(n));
  if (solitari.length > 0 && !args.includes('--compito')) {
    console.error(`${solitari.join(' e ')} serve solo insieme a --compito. Esempio: ${esempi['--compito']} --da 10:30`);
    return false;
  }
  return true;
}

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
    const dentro = chiamate.filter((c) => c.t > fine - FINESTRA_MS && c.t <= fine);
    const somma = dentro.reduce(accumula, sommaVuota());
    console.log(`Finestra ${quando(fine - FINESTRA_MS)} → ${quando(fine)} (ora del computer)`);
    console.log(`  peso ${n1(somma.peso)} su ${somma.chiamate} chiamate`);
    const perProgetto = new Map();
    for (const c of dentro) perProgetto.set(c.progetto, (perProgetto.get(c.progetto) || 0) + c.peso);
    for (const [p, v] of [...perProgetto.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${nomeProgettoLeggibile(p).padEnd(40)} ${n1(v)}`);
    }
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
