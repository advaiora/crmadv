// Lettura statica dei permessi RBAC dal sorgente: da una parte le chiavi DICHIARATE
// nel catalogo (server/auth/rbac-catalog.ts), dall'altra le chiavi USATE nel resto del
// backend. Sta qui, in un file a parte, perche' la usano due cose diverse:
//
//   1. scripts/security/rbac-catalog-check.mjs — il controllo "ogni permesso usato
//      esiste davvero nel catalogo", lanciabile con `npm run security:rbac-catalog`;
//   2. scripts/security/ai-production-route-permissions.test.mjs — il test tabellare
//      "questa rotta chiede quel permesso" sulle rotte della Produzione AI.
//
// Sono lo stesso problema visto da due lati (decisioni-cliente-e-menu-2026-08-07.md
// §7.3 ⑨ e §5.2): tenerli separati vorrebbe dire scrivere due volte lo stesso lettore
// di sorgente, e vederli divergere alla prima modifica.
//
// ⚠️ Perche' un lettore fatto a mano e non una semplice ricerca di stringhe: i commenti
// del progetto sono in italiano e pieni di apostrofi ("l'utente", "cio' che"). Una
// ricerca ingenua di stringhe fra apici li scambia per virgolette aperte, si disallinea
// e SALTA pezzi di codice — durante la lavorazione di questo compito una prova del
// genere ha perso 'projects.view_all', che invece esiste ed e' usato. Per questo il
// sorgente passa prima da `stripNonCode`, che cancella commenti, template literal ed
// espressioni regolari lasciando intatte le stringhe vere e i numeri di riga.

const REGEX_ALLOWED_BEFORE = new Set([
  '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '^', '<', '>', '~', '\n',
]);

const REGEX_ALLOWED_KEYWORDS = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'yield', 'await', 'delete', 'void', 'new',
]);

const startsRegex = (source, index) => {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(source[cursor]) && source[cursor] !== '\n') {
    cursor -= 1;
  }

  if (cursor < 0) {
    return true;
  }

  const previous = source[cursor];
  if (REGEX_ALLOWED_BEFORE.has(previous)) {
    return true;
  }

  if (!/[A-Za-z0-9_$]/.test(previous)) {
    return false;
  }

  let wordEnd = cursor + 1;
  let wordStart = cursor;
  while (wordStart >= 0 && /[A-Za-z0-9_$]/.test(source[wordStart])) {
    wordStart -= 1;
  }

  return REGEX_ALLOWED_KEYWORDS.has(source.slice(wordStart + 1, wordEnd));
};

// Sostituisce con spazi tutto cio' che non e' codice o stringa vera: commenti di riga,
// commenti a blocco, contenuto dei template literal, espressioni regolari. Lunghezza e
// posizione degli a capo restano identiche, cosi' gli indici del risultato valgono
// anche sul sorgente originale e i numeri di riga tornano.
export const stripNonCode = (source) => {
  const out = new Array(source.length);
  let index = 0;

  const blank = (position) => {
    out[position] = source[position] === '\n' ? '\n' : ' ';
  };

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') {
        blank(index);
        index += 1;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      while (index < stop) {
        blank(index);
        index += 1;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      out[index] = char;
      index += 1;
      while (index < source.length) {
        out[index] = source[index];
        if (source[index] === '\\') {
          if (index + 1 < source.length) {
            out[index + 1] = source[index + 1];
          }
          index += 2;
          continue;
        }
        if (source[index] === char) {
          index += 1;
          break;
        }
        if (source[index] === '\n') {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    if (char === '`') {
      blank(index);
      index += 1;
      while (index < source.length) {
        if (source[index] === '\\') {
          blank(index);
          if (index + 1 < source.length) {
            blank(index + 1);
          }
          index += 2;
          continue;
        }
        const closing = source[index] === '`';
        blank(index);
        index += 1;
        if (closing) {
          break;
        }
      }
      continue;
    }

    if (char === '/' && startsRegex(source, index)) {
      blank(index);
      index += 1;
      let inClass = false;
      while (index < source.length && source[index] !== '\n') {
        if (source[index] === '\\') {
          blank(index);
          if (index + 1 < source.length) {
            blank(index + 1);
          }
          index += 2;
          continue;
        }
        if (source[index] === '[') {
          inClass = true;
        } else if (source[index] === ']') {
          inClass = false;
        }
        const closing = source[index] === '/' && !inClass;
        blank(index);
        index += 1;
        if (closing) {
          break;
        }
      }
      continue;
    }

    out[index] = char;
    index += 1;
  }

  return out.join('');
};

const buildLineLookup = (source) => {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') {
      starts.push(index + 1);
    }
  }

  return (position) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (starts[middle] <= position) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return low + 1;
  };
};

const CONST_OBJECT_PATTERN = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*\{([\s\S]*?)\}\s*as const\s*;/g;
const OBJECT_ENTRY_PATTERN = /([A-Za-z_$][\w$]*)\s*:\s*'([^']*)'/g;

// Mappa NOME.proprieta' -> valore per ogni oggetto `const X = { ... } as const;`.
export const collectConstantObjects = (strippedSource) => {
  const constants = new Map();

  for (const match of strippedSource.matchAll(CONST_OBJECT_PATTERN)) {
    const [, name, body] = match;
    const entries = new Map();
    for (const entry of body.matchAll(OBJECT_ENTRY_PATTERN)) {
      entries.set(entry[1], entry[2]);
    }
    constants.set(name, entries);
  }

  return constants;
};

// Ritaglia l'array letterale assegnato alla costante che comincia in `anchor`.
// ⚠️ Si parte da dopo il segno di uguale, non dal primo '[' che si incontra: la
// dichiarazione e' `SYSTEM_PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = [`,
// e le due quadre VUOTE del tipo, scambiate per l'inizio dell'array, lo chiudevano
// subito restituendo il nulla — con l'effetto di un catalogo apparentemente vuoto e
// sessantuno falsi allarmi. Le quadre dentro le stringhe si saltano per lo stesso
// motivo: una descrizione italiana puo' contenerne.
const sliceArrayLiteral = (source, anchor) => {
  const assignment = source.indexOf('=', anchor);
  if (assignment === -1) {
    return '';
  }

  const open = source.indexOf('[', assignment);
  if (open === -1) {
    return '';
  }

  let depth = 0;
  let quote = null;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open, index + 1);
      }
    }
  }

  return source.slice(open);
};

const CATALOG_KEY_PATTERN = /\bkey\s*:\s*(?:'([^']*)'|([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*))/g;

// Le chiavi che il catalogo DICHIARA, cioe' le voci di SYSTEM_PERMISSION_CATALOG.
// Un permesso definito come costante ma mai messo nel catalogo non conta: e' proprio
// il caso che questo controllo deve prendere.
export const extractCatalogPermissions = (catalogSource) => {
  const stripped = stripNonCode(catalogSource);
  const constants = collectConstantObjects(stripped);
  const anchor = stripped.indexOf('SYSTEM_PERMISSION_CATALOG');
  if (anchor === -1) {
    throw new Error('SYSTEM_PERMISSION_CATALOG non trovato nel catalogo dei permessi');
  }

  const block = sliceArrayLiteral(stripped, anchor);
  const keys = new Set();

  for (const match of block.matchAll(CATALOG_KEY_PATTERN)) {
    const [, literal, constantName, property] = match;
    if (literal !== undefined) {
      keys.add(literal);
      continue;
    }
    const value = constants.get(constantName)?.get(property);
    if (value !== undefined) {
      keys.add(value);
    }
  }

  return keys;
};

// Due convenzioni di nome, non una: nove moduli scrivono `WEB_ASSETS_PERMISSIONS`, il vault
// scrive `VaultPermissions`. Accettando solo la prima, le sei chiavi del vault non venivano
// lette da nessuno — proprio il modulo dove un permesso sbagliato costa di piu'.
// Il suffisso resta obbligatorio apposta: nello stesso modulo c'e' `VaultAuditActions`, che
// contiene 'vault.reveal_denied' e altri NOMI DI EVENTO del registro, non permessi.
const PERMISSION_OBJECT_PATTERN = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*(?:PERMISSIONS|Permissions))\s*=\s*\{([\s\S]*?)\}\s*as const\s*;/g;
// La virgola finale prima della parentesi e' obbligatoria, non facoltativa, in ogni chiamata
// spezzata su piu' righe — cioe' nella formattazione normale del progetto:
//   await requirePermission(
//     user.id,
//     workspace.id,
//     'quotes.send',
//   );
// Finche' il pezzo finale chiedeva `'chiave'` attaccata alla parentesi, il controllo era cieco
// proprio sulla forma piu' diffusa: provato in isolamento, con la virgola non usciva nessuna
// chiave, senza la virgola usciva. Da qui il `,?` prima di `\)`.
//
// Il `[A-Za-z0-9_$]*` dopo il gruppo dei nomi c'e' perche' un cancello non arriva sempre
// col suo nome: workspace-dashboard.route.ts riceve requirePermission PER INIEZIONE, come
// `requirePermissionFn` (riga 16, `typeof requirePermission`), e lo chiama con la chiave
// scritta li'. Erano due chiamate-cancello vere e invisibili. Misurato sui 242 file .ts del
// backend: le OCCORRENZE di questa forma passano da 4 a 6 e le CHIAVI DISTINTE da 3 a 5 —
// entrano 'team.view' e 'checklists.view' — e nessuna si perde. Occorrenze e chiavi non sono
// la stessa cosa e qui divergono: 'projects.view_all' compare due volte, in
// agency.service.ts e in projects.service.ts.
//
// I nomi che il suffisso libero fa combaciare non sono tre ma CINQUE, e due non rendono
// nulla. Non rendono nulla per la loro FORMA, non per il loro nome: e' una differenza che
// conta, perche' chi domani ritocca la regex si appoggia a questo elenco, e un insieme
// dichiarato piu' stretto del vero e' peggio di nessun insieme dichiarato.
//   - requirePermission, hasPermission, requirePermissionFn: agganciano, ed e' cio' che
//     vogliamo;
//   - `hasPermissionKey` cade sull'arita': prende un argomento solo prima della chiave,
//     mentre questa forma pretende due virgole. E' la ragione per cui allargare qui NON
//     chiude il limite noto scritto piu' sotto — quello resta aperto;
//   - `requirePermissionLegacy` (server/auth/guards.ts:4, importato sotto quel nome, e :41,
//     dove viene chiamato) passa `permissionKey`, cioe' una VARIABILE e non un letterale,
//     quindi il pezzo finale `'([^']*)'` non aggancia niente. Se un giorno qualcuno gli
//     passasse una chiave scritta a mano, questa forma la leggerebbe — ed e' bene cosi'.
const GUARD_CALL_PATTERN = /\b(?:requirePermission|hasPermission)[A-Za-z0-9_$]*\s*\([^()]*?,[^(),]*?,\s*'([^']*)'\s*,?\s*\)/g;
const ENSURE_CALL_PATTERN = /\bensure[A-Za-z0-9_$]*Access\s*\([^(),]+,\s*'([^']*)'\s*\)/g;
const PERMISSION_PROPERTY_PATTERN = /\b(?:permission|permissionKey)\s*:\s*'([^']*)'/g;

// Le costanti di modulo che tengono UNA chiave sola, la forma piu' diffusa fra i moduli che
// riscrivono i permessi in casa:
//   const VIEW_PERMISSION = 'departments.view';
//   await requirePermission(user.id, workspace.id, VIEW_PERMISSION);
// Senza questa forma il controllo vedeva la chiamata ma non la chiave, e undici costanti in
// sei file restavano fuori dal controllo — proprio i moduli che il compito chiede di leggere.
// Il suffisso _PERMISSION / _PERMISSIONS e' obbligatorio per la stessa ragione del punto 1:
// in workspace-modules.route.ts convive MODULES_AUDIT_ACTION = 'modules.manage', che e' un
// nome di evento del registro attivita' e non un permesso.
const PERMISSION_CONSTANT_PATTERN = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*(?:_PERMISSION|_PERMISSIONS))\s*(?::[^=;'"]*)?=\s*'([^']*)'/g;

// Le chiavi che il codice USA. Cinque forme, tutte quelle presenti oggi nel backend:
//   1. gli oggetti `X_PERMISSIONS` / `XPermissions` = { ... } as const dei moduli che
//      riscrivono a mano i propri permessi invece di prenderli dal catalogo centrale;
//   2. le chiamate dirette a requirePermission / hasPermission con la chiave scritta li',
//      anche quando il cancello arriva per iniezione sotto un altro nome (requirePermissionFn);
//   3. le chiamate ai cancelli di modulo, ensureQualcosaAccess(request, 'chiave');
//   4. le proprieta' `permission:` / `permissionKey:` delle tabelle di navigazione;
//   5. le costanti di modulo a chiave singola, `const VIEW_PERMISSION = 'departments.view'`.
// Volutamente NON si accetta qualunque stringa con un punto dentro: nel backend ce ne
// sono a decine che permessi non sono (nomi di evento del registro attivita' come
// 'team.invite_accepted', nomi di file, host). Il contesto ristretto e' cio' che rende
// il controllo utile invece che rumoroso.
//
// LIMITE NOTO, dichiarato e non ancora chiuso: la SESTA forma resta fuori, e oggi e' la sola.
// Il modulo Dashboard non chiama i cancelli comuni, ha due helper propri —
// `hasPermissionKey` / `hasAnyPermissionKey`, dichiarati in
// server/modules/dashboard/dashboard.policies.ts e usati anche in dashboard.service.ts —
// che ricevono le chiavi come argomento singolo o dentro array scritti su piu' righe:
//   hasPermissionKey(permissionKeys, 'projects.view')
//   hasAnyPermissionKey(permissionKeys, [
//     'projects.edit',
//     'quotes.send',
//   ])
// Nessuna delle cinque forme qui sopra le vede. Misurato sul codice di oggi sono
// 22 chiavi distinte fra dashboard.policies.ts e dashboard.service.ts (23 contando anche
// 'modules.view', che a catalogo non c'e' ed e' una questione di prodotto aperta a parte).
// Il perimetro e' quello e SOLO quello: il terzo file della Dashboard,
// routes/workspace-dashboard.route.ts, non e' piu' un buco — le sue due chiamate-cancello
// (team.view, checklists.view) le prende la forma 2 da quando GUARD_CALL_PATTERN accetta
// anche i nomi iniettati. Prima erano un buco che questo commento non nominava — parlava
// solo di policies.ts e service.ts — e chi lo leggeva concludeva che fuori dagli helper il
// controllo coprisse tutto. E' il motivo per cui adesso il perimetro e' scritto per esteso
// invece che per esempi: un limite dichiarato piu' stretto del vero e' peggio di nessun
// limite dichiarato, perche' a quello ci si affida.
// Conseguenza pratica da tenere a mente leggendo un verde di questo controllo: un refuso
// dentro `resolveRoleTierFromPermissions` passa senza che nessuno lo segnali — ed e' per
// questo che rbac-catalog-check.mjs lo ripete a voce nel proprio messaggio di successo,
// dove qualcuno lo legge davvero, invece di lasciarlo solo qui.
// Non e' un difetto da chiudere di passaggio: aggiungere la forma-array significa decidere
// come distinguere un array di permessi da un array di nomi di evento, che e' lo stesso
// problema gia' risolto altrove col suffisso obbligatorio ma qui non ha un appiglio uguale.
export const extractPermissionUsages = (source) => {
  const stripped = stripNonCode(source);
  const lineOf = buildLineLookup(stripped);
  const usages = [];

  for (const match of stripped.matchAll(PERMISSION_OBJECT_PATTERN)) {
    const bodyOffset = match.index + match[0].indexOf(match[2], match[1].length);
    for (const entry of match[2].matchAll(OBJECT_ENTRY_PATTERN)) {
      usages.push({
        key: entry[2],
        line: lineOf(bodyOffset + entry.index),
        origin: match[1],
      });
    }
  }

  const scanCalls = (pattern, origin) => {
    for (const match of stripped.matchAll(pattern)) {
      usages.push({ key: match[1], line: lineOf(match.index), origin });
    }
  };

  scanCalls(GUARD_CALL_PATTERN, 'requirePermission');
  scanCalls(ENSURE_CALL_PATTERN, 'ensureAccess');
  scanCalls(PERMISSION_PROPERTY_PATTERN, 'permission');

  // Qui l'origine e' il nome della costante, come per gli oggetti X_PERMISSIONS: dice a chi
  // legge l'errore quale riga cambiare, non solo che una chiave e' sbagliata.
  for (const match of stripped.matchAll(PERMISSION_CONSTANT_PATTERN)) {
    usages.push({ key: match[2], line: lineOf(match.index), origin: match[1] });
  }

  return usages;
};

const ROUTE_METHOD_PATTERN = /\bapp\.(get|post|put|patch|delete)\b/g;
const ROUTE_PATH_PATTERN = /'([^']*)'/;
const ROUTE_GUARD_PATTERN = /\bensure([A-Za-z0-9_$]*)Access\s*\(\s*[^(),]+?\s*(?:,\s*(?:'([^']*)'|([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*))\s*)?\)/;
const GUARD_ALIAS_PATTERN = /\bconst\s+(ensure[A-Za-z0-9_$]*Access)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*ensure[A-Za-z0-9_$]*Access\s*\(\s*[^(),]+,\s*(?:'([^']*)'|([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*))\s*\)/g;

// I cancelli scorciatoia dichiarati dentro il file stesso, del tipo
//   const ensureAgencySettingsAccess = async (request) =>
//     ensureAiProductionAccess(request, AI_PRODUCTION_PERMISSIONS.manageSettings);
// Senza risolverli, le rotte che li usano risultano SENZA permesso pur avendone uno —
// un falso allarme che, se lasciato passare, insegna a non fidarsi della tabella.
export const collectGuardAliases = (strippedSource, constants = new Map()) => {
  const aliases = new Map();

  for (const match of strippedSource.matchAll(GUARD_ALIAS_PATTERN)) {
    const [, name, literal, constantName, property] = match;
    const key = literal ?? constants.get(constantName)?.get(property);
    if (key !== undefined) {
      aliases.set(name, key);
    }
  }

  return aliases;
};

// Le rotte dichiarate in un file di rotte, ciascuna col permesso che chiede. Serve al
// test tabellare: la tabella attesa sta nel test, qui c'e' solo la lettura.
// `permission: null` significa che fra la dichiarazione della rotta e quella successiva
// non compare nessun cancello — la tabella lo dice apertamente invece di nasconderlo.
export const extractRoutePermissions = (source, constants = new Map()) => {
  const stripped = stripNonCode(source);
  const aliases = collectGuardAliases(stripped, constants);
  const anchors = [...stripped.matchAll(ROUTE_METHOD_PATTERN)];
  const routes = [];

  anchors.forEach((anchor, position) => {
    const start = anchor.index + anchor[0].length;
    const end = position + 1 < anchors.length ? anchors[position + 1].index : stripped.length;
    const body = stripped.slice(start, end);

    const pathMatch = body.match(ROUTE_PATH_PATTERN);
    const guardMatch = body.match(ROUTE_GUARD_PATTERN);
    const [, guardName, literal, constantName, property] = guardMatch ?? [];
    const guard = guardMatch ? `ensure${guardName}Access` : null;

    routes.push({
      method: anchor[1].toUpperCase(),
      path: pathMatch ? pathMatch[1] : null,
      guard,
      permission: literal
        ?? constants.get(constantName)?.get(property)
        ?? aliases.get(guard)
        ?? null,
    });
  });

  return routes;
};
