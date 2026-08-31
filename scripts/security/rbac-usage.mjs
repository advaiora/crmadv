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

const PERMISSION_OBJECT_PATTERN = /(?:export\s+)?const\s+([A-Za-z_$][\w$]*PERMISSIONS)\s*=\s*\{([\s\S]*?)\}\s*as const\s*;/g;
const GUARD_CALL_PATTERN = /\b(?:requirePermission|hasPermission)\s*\([^()]*?,[^(),]*?,\s*'([^']*)'\s*\)/g;
const ENSURE_CALL_PATTERN = /\bensure[A-Za-z0-9_$]*Access\s*\([^(),]+,\s*'([^']*)'\s*\)/g;
const PERMISSION_PROPERTY_PATTERN = /\b(?:permission|permissionKey)\s*:\s*'([^']*)'/g;

// Le chiavi che il codice USA. Quattro forme, tutte quelle presenti oggi nel backend:
//   1. gli oggetti `X_PERMISSIONS = { ... } as const` dei moduli che riscrivono a mano
//      i propri permessi invece di prenderli dal catalogo centrale;
//   2. le chiamate dirette a requirePermission / hasPermission con la chiave scritta li';
//   3. le chiamate ai cancelli di modulo, ensureQualcosaAccess(request, 'chiave');
//   4. le proprieta' `permission:` / `permissionKey:` delle tabelle di navigazione.
// Volutamente NON si accetta qualunque stringa con un punto dentro: nel backend ce ne
// sono a decine che permessi non sono (nomi di evento del registro attivita' come
// 'team.invite_accepted', nomi di file, host). Il contesto ristretto e' cio' che rende
// il controllo utile invece che rumoroso.
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

  return usages;
};

const ROUTE_METHOD_PATTERN = /\bapp\.(get|post|put|patch|delete)\b/g;
const ROUTE_PATH_PATTERN = /'([^']*)'/;
const ROUTE_GUARD_PATTERN = /\bensure([A-Za-z0-9_$]*)Access\s*\(\s*[^(),]+,\s*(?:'([^']*)'|([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*))/;

// Le rotte dichiarate in un file di rotte, ciascuna col permesso che chiede. Serve al
// test tabellare: la tabella attesa sta nel test, qui c'e' solo la lettura.
// `permission: null` significa che fra la dichiarazione della rotta e quella successiva
// non compare nessun cancello — la tabella lo dice apertamente invece di nasconderlo.
export const extractRoutePermissions = (source, constants = new Map()) => {
  const stripped = stripNonCode(source);
  const anchors = [...stripped.matchAll(ROUTE_METHOD_PATTERN)];
  const routes = [];

  anchors.forEach((anchor, position) => {
    const start = anchor.index + anchor[0].length;
    const end = position + 1 < anchors.length ? anchors[position + 1].index : stripped.length;
    const body = stripped.slice(start, end);

    const pathMatch = body.match(ROUTE_PATH_PATTERN);
    const guardMatch = body.match(ROUTE_GUARD_PATTERN);
    const [, guardName, literal, constantName, property] = guardMatch ?? [];

    routes.push({
      method: anchor[1].toUpperCase(),
      path: pathMatch ? pathMatch[1] : null,
      guard: guardMatch ? `ensure${guardName}Access` : null,
      permission: literal ?? constants.get(constantName)?.get(property) ?? null,
    });
  });

  return routes;
};
