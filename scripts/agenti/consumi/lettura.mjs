// Lettura e normalizzazione dei registri JSONL (spezzato da consumi.mjs il
// 3/8/2026). E' il modulo piu' delicato: qui vivono la nota #36 (le chiamate
// dei subagent stanno in sottocartelle subagents/) e la nota #39 (una chiamata
// sta su PIU' righe con lo stesso requestId: si fonde tenendo il massimo).
import fs from 'node:fs';
import path from 'node:path';
import { MOLT_LETTURA_CACHE, MOLT_SCRITTURA_CACHE, prezzoDi } from './prezzi.mjs';

export function peso(uso, modello) {
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
export function elencaJsonl(base) {
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

export function leggiChiamate(base, dirProgettoCorrente = null) {
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
