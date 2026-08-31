// «Ogni permesso usato esiste davvero nel catalogo.»
//
// CLAUDE.md lo dice dal re-naming: il permesso nasce insieme al pezzo di CRM, e la voce
// nel catalogo (server/auth/rbac-catalog.ts) fa parte di cio' che significa "finito".
// Finora la regola era scritta ma non verificata da nessuno: oggi solo quattro moduli su
// sedici prendono le chiavi dal catalogo centrale, gli altri se le riscrivono in casa. Un
// permesso scritto a mano e sbagliato non da' errore: la rotta lo chiede, nessun ruolo
// puo' concederlo, e la funzione semplicemente non compare a nessuno. Lo si scopre mesi
// dopo, da un utente. Questo controllo lo fa scoprire a una macchina.
//
// Ricalca scripts/security/vault-hygiene-check.mjs: script Node autonomo, nessuna
// dipendenza, esce 1 elencando file e chiave. Si lancia con `npm run security:rbac-catalog`.
//
// ⚠️ Cosa NON fa, di proposito:
//   - non controlla che ogni rotta ABBIA un permesso: e' la "meta' 2", tenuta fuori
//     dalla release (decisioni-cliente-e-menu-2026-08-07.md §7.6);
//   - non tocca il catalogo e non corregge niente. Se trova un permesso-ombrello o una
//     chiave orfana la nomina, e si ferma li';
//   - non ricontrolla i permessi elencati dai cinque ruoli di sistema: quel controllo
//     esiste gia' ed e' migliore di uno statico, perche' importa gli oggetti veri invece
//     di rileggere il sorgente — server/auth/rbac-catalog.unit.test.ts, prova «i ruoli di
//     sistema assegnano solo permessi presenti nel catalogo». Rifarlo qui vorrebbe dire
//     due controlli sulla stessa cosa, destinati a divergere.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { extractCatalogPermissions, extractPermissionUsages } from './rbac-usage.mjs';

export const CATALOG_PATH = 'server/auth/rbac-catalog.ts';

// Cio' che questo controllo NON guarda, in una riga da stampare insieme al verde. Esportata
// perche' una prova la tiene ferma: e' l'unico pezzo del messaggio che qualcuno potrebbe
// togliere credendolo rumore, ed e' proprio quello che evita di leggere il verde come una
// copertura totale. Il perimetro per esteso sta in scripts/security/rbac-usage.mjs.
export const UNCOVERED_NOTICE = 'Non coperte: le chiavi passate agli helper della Dashboard '
  + '(hasPermissionKey / hasAnyPermissionKey in dashboard.policies.ts e dashboard.service.ts, '
  + 'oggi 22 chiavi) - vedi il limite noto in scripts/security/rbac-usage.mjs.';

const SCAN_DIRECTORIES = ['server'];
const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.mts']);

// I test restano fuori: costruiscono apposta chiavi che non esistono ('fake.permission')
// per dimostrare che il diniego funziona. Includerli vorrebbe dire spegnere il controllo
// a furia di eccezioni.
const isExcluded = (relativePath) =>
  relativePath === CATALOG_PATH
  || relativePath.endsWith('.test.ts')
  || relativePath.endsWith('.smoke.ts')
  || relativePath.endsWith('.d.ts');

const toPosixPath = (value) => value.split(path.sep).join('/');

const collectFiles = async (directoryPath) => {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }

    if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

// Il cuore del controllo, separato dalla lettura del disco perche' il test lo possa
// chiamare con dei sorgenti finti invece di dover costruire un albero di file.
export const findUnknownPermissions = ({ catalogSource, files }) => {
  const catalog = extractCatalogPermissions(catalogSource);
  const problems = [];

  const check = (relativePath, usages) => {
    for (const usage of usages) {
      if (catalog.has(usage.key)) {
        continue;
      }
      problems.push({
        file: relativePath,
        line: usage.line,
        key: usage.key,
        origin: usage.origin,
      });
    }
  };

  for (const file of files) {
    check(file.path, extractPermissionUsages(file.source));
  }

  return { catalogSize: catalog.size, problems };
};

export const formatProblem = (problem) =>
  `${problem.file}:${problem.line} usa il permesso '${problem.key}' (da ${problem.origin}), che non esiste nel catalogo ${CATALOG_PATH}`;

const run = async () => {
  const root = process.cwd();
  const catalogSource = await fs.readFile(path.join(root, CATALOG_PATH), 'utf8');

  const files = [];
  for (const directory of SCAN_DIRECTORIES) {
    for (const fullPath of await collectFiles(path.join(root, directory))) {
      const relativePath = toPosixPath(path.relative(root, fullPath));
      if (isExcluded(relativePath)) {
        continue;
      }
      files.push({ path: relativePath, source: await fs.readFile(fullPath, 'utf8') });
    }
  }

  const { catalogSize, problems } = findUnknownPermissions({ catalogSource, files });

  if (problems.length > 0) {
    process.stderr.write('Controllo dei permessi RBAC fallito.\n');
    for (const problem of problems) {
      process.stderr.write(`- ${formatProblem(problem)}\n`);
    }
    const conteggio = problems.length === 1
      ? '1 permesso usato non esiste nel catalogo'
      : `${problems.length} permessi usati non esistono nel catalogo`;
    process.stderr.write(
      `\n${conteggio}. Aggiungere la voce in ${CATALOG_PATH} e rivedere i cinque ruoli di sistema `
      + '(CLAUDE.md, regole ① e ①-bis): un permesso senza voce nel catalogo e senza ruolo '
      + 'che lo concede e\' una funzione che nessuno puo\' usare.\n',
    );
    process.exit(1);
  }

  // Il verde dice cio' che il controllo ha fatto; da solo si legge come "i permessi del
  // backend sono a posto", che e' di piu'. Il limite noto e' scritto con cura, ma vive in un
  // commento di rbac-usage.mjs: nessuno lo ha davanti nel momento in cui guarda l'uscita del
  // comando. La seconda riga serve a far viaggiare il buco insieme al verde.
  process.stdout.write(
    `Controllo dei permessi RBAC passato: ${files.length} file letti, `
    + `${catalogSize} permessi a catalogo, nessuna chiave sconosciuta.\n`
    + `${UNCOVERED_NOTICE}\n`,
  );
};

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    process.stderr.write(`Controllo dei permessi RBAC in errore: ${String(error)}\n`);
    process.exit(1);
  });
}
