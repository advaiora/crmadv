// Calibrazione peso → percentuale del limite (spezzato da consumi.mjs il
// 3/8/2026). Il rapporto fra "peso" e percentuale reale del limite non e'
// pubblicato e non e' leggibile da nessuna parte in locale. Si impara dai
// campioni che l'utente fornisce leggendo /usage nell'app.
//
// Nota sul nome: il DATO omonimo sta in archivio-documenti/consumi/
// calibrazione.json — questo e' il CODICE che lo legge. Stesso concetto,
// stesso nome, cartelle diverse.
import fs from 'node:fs';
import { FILE_CALIBRAZIONE } from './config.mjs';

export function leggiCalibrazione() {
  try {
    const j = JSON.parse(fs.readFileSync(FILE_CALIBRAZIONE, 'utf8'));
    // I campioni marcati "escluso" restano nel file come memoria storica ma
    // non entrano nella stima (di solito: presi con un metro non confrontabile).
    return Array.isArray(j.campioni) ? j.campioni.filter((c) => c.peso > 0 && c.percentuale > 0 && !c.escluso) : [];
  } catch {
    return [];
  }
}

export function stimaPercentuale(campioni, pesoAttuale) {
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
