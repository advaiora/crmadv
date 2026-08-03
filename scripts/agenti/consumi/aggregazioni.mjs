// Somme, finestre e sessioni (spezzato da consumi.mjs il 3/8/2026).
// Tutto puro: lavora su array di chiamate gia' lette, non tocca il disco.
import { FINESTRA_MS } from './config.mjs';

export function sommaVuota() {
  return { peso: 0, entrata: 0, uscita: 0, cacheScritta: 0, cacheLetta: 0, chiamate: 0 };
}
export function accumula(acc, c) {
  acc.peso += c.peso;
  acc.entrata += c.entrata;
  acc.uscita += c.uscita;
  acc.cacheScritta += c.cacheScritta;
  acc.cacheLetta += c.cacheLetta;
  acc.chiamate += 1;
  return acc;
}

export function piccoFinestra(chiamate) {
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

export function perSessione(chiamate) {
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

export function mediana(valori) {
  if (valori.length === 0) return 0;
  const v = [...valori].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}
