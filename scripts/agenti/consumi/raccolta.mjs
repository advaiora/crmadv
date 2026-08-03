// La raccolta del quadro: legge tutto e prepara i dati (spezzato da
// consumi.mjs il 3/8/2026). E' il punto in cui i moduli si integrano.
import os from 'node:os';
import path from 'node:path';
import { FINESTRA_MS } from './config.mjs';
import { cartellaRegistri, cartellaTuttiProgetti } from './cartelle.mjs';
import { leggiChiamate } from './lettura.mjs';
import { accumula, mediana, perSessione, piccoFinestra, sommaVuota } from './aggregazioni.mjs';
import { leggiCalibrazione, stimaPercentuale } from './calibrazione.mjs';
import { analizzaAgenti } from './agenti.mjs';

export function raccogli() {
  // Nota #38: a leggiChiamate va passata la radice di TUTTI i progetti (il
  // limite e' dell'account); la cartella del progetto corrente serve SOLO a
  // etichettare cosa e' nostro. Non "semplificare" passando la cartella
  // ristretta: e' il bug gia' corretto il 31/7.
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
