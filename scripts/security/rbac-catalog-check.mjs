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
//   - non legge il frontend: guarda solo server/, mentre le chiavi scritte a mano in src/
//     sono di piu' di quelle del backend — perche' e' cosi' e cosa costerebbe cambiarlo sta
//     accanto a SCAN_DIRECTORIES, qui sotto (CRM-64);
//   - non ricontrolla i permessi elencati dai cinque ruoli di sistema: quel controllo
//     esiste gia' ed e' migliore di uno statico, perche' importa gli oggetti veri invece
//     di rileggere il sorgente — server/auth/rbac-catalog.unit.test.ts, prova «i ruoli di
//     sistema assegnano solo permessi presenti nel catalogo». Rifarlo qui vorrebbe dire
//     due controlli sulla stessa cosa, destinati a divergere.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { extractCatalogPermissions, extractPermissionUsages } from './rbac-usage.mjs';

export const CATALOG_PATH = 'server/auth/rbac-catalog.ts';

// Cio' che questo controllo NON guarda, in una riga da stampare insieme al verde. E' l'unico
// pezzo del messaggio che qualcuno potrebbe togliere credendolo rumore, ed e' proprio quello
// che evita di leggere il verde come una copertura totale. Il perimetro per esteso sta in
// scripts/security/rbac-usage.mjs.
//
// Esportata, ma da sola non basta, ed e' un errore in cui questo file e' gia' caduto: una
// prova che asserisce sul CONTENUTO della costante tiene ferma la stringa e lascia libera la
// sua STAMPA. Chi cancellasse la riga che la concatena nell'uscita non farebbe cadere niente,
// e il verde tornerebbe a leggersi come copertura totale — il guasto esatto che questa
// costante esiste per prevenire. Per questo il messaggio si compone in formatSuccessMessage
// qui sotto, che le prove chiamano davvero (CRM-67).
//
// Il conteggio preciso delle chiavi Dashboard (22, oggi) NON sta in questa riga: stampato
// sarebbe un numero esatto che nessuna prova tiene vero, invecchiato in silenzio al primo
// helper aggiunto — lo stesso ragionamento per cui il frontend si dichiara con «oltre 160»
// invece che con 164. Vive nel commento del limite noto in scripts/security/rbac-usage.mjs,
// dove chi lo legge sta gia' guardando il codice che lo produce.
//
// I buchi da dichiarare sono DUE, e il secondo e' il piu' grande. Il primo e' una forma che
// l'estrattore non legge (gli helper della Dashboard); il secondo e' meta' della catena che
// questo controllo non apre affatto, il frontend — vedi SCAN_DIRECTORIES qui sotto. Nominare
// solo il primo sposterebbe il problema invece di chiuderlo: chi legge un verde che dichiara
// un buco solo conclude che tutto il resto sia coperto.
export const UNCOVERED_NOTICE = 'Non coperte: le chiavi passate agli helper della Dashboard '
  + '(hasPermissionKey / hasAnyPermissionKey in dashboard.policies.ts e dashboard.service.ts), '
  + 'e tutto il frontend - questo controllo legge solo server/, mentre src/ tiene oltre 160 '
  + 'chiavi di permesso scritte a mano (CRM-64). '
  + 'Vedi il limite noto in scripts/security/rbac-usage.mjs.';

// Solo il backend, e non perche' il frontend non conti: li' il guasto e' identico e piu'
// visibile. Un refuso in una chiave dentro src/layout/Sidebar/SidebarMenu.jsx (38 chiavi
// scritte a mano) o in src/layout/Mobile/MobileBottomNav.jsx (10) non da' errore e fa
// semplicemente sparire una voce di menu — il guasto che questo controllo esiste per
// prevenire, sull'altra meta' della catena. Misurato oggi contro il catalogo: 164 chiavi a
// catalogo scritte a mano in 33 file di src/, test esclusi (una misura indipendente ne conta
// 173 — dipende da cosa si esclude; l'ordine di grandezza e' quello, ed e' il motivo per cui
// la riga stampata dice «oltre 160» invece di un numero preciso che invecchierebbe male).
// Allargare il perimetro non e' gratis e non e' una decisione di questo giro: l'estrattore
// com'e' aggancia 3 usi soli su 450 file del frontend, e sui nomi di evento del Registro
// attivita' in TopNav.jsx sbaglia. Misura e opzioni di appiglio stanno in CRM-64.
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

// Il testo del verde, composto qui e non dentro `run` per una ragione sola: `run` non e'
// esportata, quindi niente di cio' che compone puo' essere provato. Spostato qui, il messaggio
// diventa il valore di ritorno di una funzione che le prove chiamano — e togliere la riga del
// limite noto dall'uscita fa cadere una prova, invece di passare inosservato.
//
// Il verde dice cio' che il controllo ha fatto; da solo si legge come "i permessi del backend
// sono a posto", che e' di piu'. La seconda riga serve a far viaggiare il buco insieme al
// verde: il limite e' scritto con cura, ma vive in un commento di rbac-usage.mjs, che nessuno
// ha davanti nel momento in cui guarda l'uscita del comando.
export const formatSuccessMessage = ({ fileCount, catalogSize }) =>
  `Controllo dei permessi RBAC passato: ${fileCount} file letti, `
  + `${catalogSize} permessi a catalogo, nessuna chiave sconosciuta.\n`
  + `${UNCOVERED_NOTICE}`;

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

  process.stdout.write(`${formatSuccessMessage({ fileCount: files.length, catalogSize })}\n`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    process.stderr.write(`Controllo dei permessi RBAC in errore: ${String(error)}\n`);
    process.exit(1);
  });
}
