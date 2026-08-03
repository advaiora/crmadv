// Il conto degli agent (spezzato da consumi.mjs il 3/8/2026).
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
import { TEAM_DI_PROGETTO } from './config.mjs';
import { MOLT_LETTURA_CACHE, MOLT_SCRITTURA_CACHE, prezzoDi } from './prezzi.mjs';

// Ripiego per riconoscere gli agent che la risposta della chiamata non identifica
// (succede con le versioni piu' vecchie di Claude Code, dove il risultato era il
// rapporto dell'agent e non conteneva l'identificativo). Dentro una stessa
// sessione si accoppiano in ordine di tempo le chiamate rimaste spaiate con gli
// agent rimasti senza tipo: e' l'unico ordine possibile, visto che partono e
// finiscono in sequenza. Sta qui e non in lettura.mjs perche' l'unico chiamante
// e' analizzaAgenti, e i suoi parametri sono forme dati dell'analisi.
export function abbinaPerOrdine(agentiSenzaTipo, lanci) {
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

// Quanto sarebbe costato tenersi in conversazione un testo di `tenutoFuori` token:
// una scrittura in memoria (che si paga comunque, appena il testo entra) piu' una
// rilettura per ogni risposta arrivata dopo.
export function costoSeFosseInLinea(tenutoFuori, dopo, modelloRipiego) {
  if (tenutoFuori <= 0) return 0;
  const primo = prezzoDi(dopo.length > 0 ? dopo[0].modello : modelloRipiego);
  let costo = (tenutoFuori * primo.in * MOLT_SCRITTURA_CACHE) / 1e6;
  for (const c of dopo) costo += (tenutoFuori * prezzoDi(c.modello).in * MOLT_LETTURA_CACHE) / 1e6;
  return costo;
}

export function analizzaAgenti(chiamate, { tipiAgente, lanci, testoFinale }, soloNostro) {
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
