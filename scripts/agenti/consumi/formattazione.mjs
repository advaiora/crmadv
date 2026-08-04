// Come si raccontano i numeri (spezzato da consumi.mjs il 3/8/2026).
// Tutto puro: numeri e millisecondi entrano, stringhe in italiano escono.

// I nomi delle cartelle dei registri sono il percorso del progetto con i
// separatori sostituiti da trattini: si accorciano per renderli leggibili.
// Sta qui e non fra le cartelle perche' serve solo a STAMPARE il nome, non a
// trovarlo sul disco (la usano il quadro e il ramo --finestra-a).
export function nomeProgettoLeggibile(cartella) {
  return cartella.replace(/^[A-Za-z]--Users-[^-]+-Documents-/, '').replace(/^[A-Za-z]--/, '');
}

// I decimali si scrivono con la virgola: e' un report in italiano.
export const n1 = (x) => x.toFixed(1).replace('.', ',');
export const n2 = (x) => x.toFixed(2).replace('.', ',');
export const n0 = (x) => x.toFixed(0);
export const mln = (x) => `${(x / 1e6).toFixed(2).replace('.', ',')}M`;

// Le ore si stampano nell'ORA DEL COMPUTER, non in UTC: chi rilegge il registro
// deve poterle confrontare con l'ora dei commit e con la propria giornata. (Prima
// uscivano in UTC senza dirlo, e le righe risultavano indietro di due ore.)
export function quando(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Numeri grossi detti a parole, come si direbbe parlando. L'unita' di misura
// ("token") la mette la frase una volta sola, non ogni numero.
export function aParole(tok) {
  if (tok >= 1e6) return `${n1(tok / 1e6)} milioni`;
  if (tok >= 1000) return `${Math.round(tok / 1000)} mila`;
  return String(tok);
}

export function durataAParole(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}

// La velocita' di consumo, in unita' al minuto. E' la chiave per le domande di
// CAPACITA' della finestra — rate x durata contro le 5 ore — decisa il
// 4/8/2026. NON si usa per giudicare gli agent: il parallelismo alza le
// unita'/min anche quando abbassa le unita' totali del lavoro (registro
// decisioni in team-agenti.md). Si calcola sui MINUTI ARROTONDATI, gli stessi
// che stampa durataAParole: cosi' la cella della velocita' e la colonna della
// durata tornano sempre l'una con l'altra, e una riga rifatta col comando
// riproduce la cella. Sotto il mezzo minuto (durata stampata 0) niente rate.
export function unitaAlMinuto(peso, ms) {
  const min = Math.round(ms / 60000);
  if (min < 1) return null;
  return peso / min;
}

export function velocita(peso, ms) {
  const v = unitaAlMinuto(peso, ms);
  return v === null ? null : `${n2(v)} unità/min`;
}

// A che punto sei della finestra, detto in modo utile per decidere se attaccare
// un lavoro grosso o chiudere bottega.
export function comeSiamoMessi(percentuale) {
  if (percentuale < 15) return 'La finestra è quasi intatta, puoi attaccare un lavoro grosso.';
  if (percentuale < 40) return "Sei intorno a un terzo: c'è spazio per un pezzo di lavoro intero.";
  if (percentuale < 60) return 'Sei circa a metà: un altro pezzo ci sta, uno lungo forse no.';
  if (percentuale < 80) return 'Hai passato i due terzi, conviene chiudere quello che è già aperto.';
  return 'Sei vicino al limite: meglio non iniziare niente di lungo, si rischia il blocco a metà lavoro.';
}

// "il 5%" ma "l'8%": l'articolo si elide davanti ai numeri che in italiano
// iniziano per vocale — uno, otto, undici, ottanta e i suoi (ottantuno...).
export function ilPerCento(x) {
  const v = Math.round(x);
  if (x > 0 && v === 0) return "meno dell'1%";
  const elide = v === 1 || v === 8 || v === 11 || (v >= 80 && v <= 89);
  return `${elide ? "l'" : 'il '}${v}%`;
}

export function barra(frazione, larghezza = 40) {
  const pieni = Math.max(0, Math.min(larghezza, Math.round(frazione * larghezza)));
  return '#'.repeat(pieni).padEnd(larghezza, '.');
}
