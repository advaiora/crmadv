// Costanti condivise del monitor consumi (spezzato da consumi.mjs il 3/8/2026).
// Qui stanno solo le cose che più moduli devono vedere uguali: la finestra del
// limite, chi fa parte del team di progetto, e i percorsi dei file scritti.
import path from 'node:path';

export const FINESTRA_MS = 5 * 60 * 60 * 1000; // la finestra di consumo e' di 5 ore

// Gli agent scritti per questo progetto (.claude/agents/). Gli altri nomi che
// compaiono nei registri sono gli agent di serie di Claude Code.
export const TEAM_DI_PROGETTO = ['esploratore', 'revisore', 'architetto'];

export const RADICE = process.cwd();
export const FILE_CALIBRAZIONE = path.join(RADICE, 'archivio-documenti', 'consumi', 'calibrazione.json');
export const FILE_REGISTRO = path.join(RADICE, 'archivio-documenti', 'consumi', 'registro.md');
export const FILE_COMPITI = path.join(RADICE, 'archivio-documenti', 'consumi', 'registro-compiti.md');
