// Dove stanno i registri di Claude Code (spezzato da consumi.mjs il 3/8/2026).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RADICE } from './config.mjs';

// Radice di TUTTI i progetti: e' quella che si misura, perche' il limite
// dell'abbonamento e' unico per l'account (nota #38: MAI restringere questa
// funzione al progetto corrente, il bug e' gia' stato fatto e corretto il 31/7).
export function cartellaTuttiProgetti() {
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
export function cartellaRegistri() {
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
