import type { FastifyRequest } from 'fastify';
import { badRequest } from '../../core/errors.js';
import { detectCsvDelimiter, parseCsvRows } from './csv.js';
import { parseExcelBuffer, type ParsedSheet } from '../agency-os/reporting/excel-parser.js';

// Trasporto del file di import clienti: dal multipart alle righe grezze.
// Sta qui e non in service.ts (1307 righe, oltre la soglia-mostro) perche' il
// codice nuovo nasce accanto, come csv.ts. Qui non si valida nessun cliente:
// si riconosce il formato, si legge il contenuto e si consegnano le celle.

// Specchio del tetto gia' registrato in app.ts (@fastify/multipart, fileSize
// 20MB): se cambia li', cambia qui. Serve solo al messaggio d'errore.
export const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_FILE_LABEL = '20MB';

export type ClientImportFormat = 'csv' | 'xlsx';

export type ClientImportSource = {
  format: ClientImportFormat;
  // Nullo sugli Excel: li' le colonne sono celle, non c'e' nessun separatore.
  delimiter: ReturnType<typeof detectCsvDelimiter> | null;
  rows: string[][];
  dryRun: boolean;
};

export type ClientImportUpload = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  dryRun: boolean;
};

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_MIME_TYPES = new Set(['text/csv', 'application/csv', 'text/plain']);
const CSV_EXTENSIONS = new Set(['csv', 'txt']);

// Il nome del file serve SOLO a leggere l'estensione: non se ne ricava mai un
// percorso, e le eventuali cartelle davanti (IE le manda) vengono buttate.
const readExtension = (filename: string) => {
  const base = filename.split(/[\\/]/).pop() ?? '';
  return /\.([a-z0-9]+)$/i.exec(base)?.[1]?.toLowerCase() ?? '';
};

type ContentKind = 'xlsx' | 'legacyXls' | 'text' | 'binary';

const startsWith = (buffer: Buffer, signature: number[]) =>
  buffer.length >= signature.length && signature.every((byte, index) => buffer[index] === byte);

// Il tipo si controlla sul contenuto, non sull'estensione: un .xlsx e' uno zip
// (PK\x03\x04), un .xls vecchio e' un contenitore OLE2, e un testo non ha byte
// nulli. E' il controllo che impedisce di far leggere a exceljs un eseguibile
// rinominato.
const sniffContent = (buffer: Buffer): ContentKind => {
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    return 'xlsx';
  }

  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0])) {
    return 'legacyXls';
  }

  // Un byte nullo nei primi 8KB e' la firma piu' affidabile di "non e' testo".
  if (buffer.subarray(0, 8192).includes(0x00)) {
    return 'binary';
  }

  return 'text';
};

const resolveFormat = (extension: string, mimeType: string, content: ContentKind): ClientImportFormat => {
  if (content === 'legacyXls') {
    throw badRequest(
      'Il file è un Excel in formato vecchio (.xls). Riaprilo in Excel e salvalo come .xlsx, poi ricaricalo.',
    );
  }

  if (content === 'binary') {
    throw badRequest('Il file non è un CSV né un Excel (.xlsx). Carica un file in uno di questi due formati.');
  }

  // Contenuto zip: e' davvero un .xlsx, comunque si chiami il file.
  if (content === 'xlsx') {
    return 'xlsx';
  }

  const looksLikeExcel = extension === 'xlsx' || mimeType === XLSX_MIME;
  if (looksLikeExcel) {
    throw badRequest(
      'Il file si presenta come Excel (.xlsx) ma il contenuto non lo è. Riesportalo da Excel, oppure salvalo come CSV.',
    );
  }

  const looksLikeCsv =
    extension === '' || CSV_EXTENSIONS.has(extension) || CSV_MIME_TYPES.has(mimeType.split(';')[0].trim());
  if (!looksLikeCsv) {
    throw badRequest(`Formato non supportato (.${extension}). Sono accettati solo CSV e Excel (.xlsx).`);
  }

  return 'csv';
};

// exceljs consegna le righe come oggetti intestazione->valore, mentre l'import
// clienti lavora su array di celle nell'ordine delle colonne. Questo e' il
// raccordo fra i due: senza, si finirebbe a duplicare tutta la mappatura degli
// alias di intestazione solo per l'Excel.
export const sheetToRows = (sheet: ParsedSheet): string[][] => {
  const header = sheet.headers.map((label) => label.trim());
  // Intestazioni ripetute: exceljs le riduce a una sola chiave, quindi le
  // colonne gemelle portano lo stesso valore. A valle vince la prima non vuota,
  // come gia' succede col CSV.
  const rows = sheet.rows.map((record) => sheet.headers.map((label) => cellToText(record[label])));

  return [header, ...rows];
};

const cellToText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  // Una data letta da Excel diventa la sua parte di giorno: le celle che ci
  // interessano sono testuali, e una data qui e' quasi sempre un formato
  // applicato per sbaglio a un codice.
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value);
};

const decodeCsv = (buffer: Buffer) => {
  // Non "fatal": un CSV salvato da Excel in Windows-1252 deve continuare a
  // entrare come entrava prima (con i caratteri accentati storpiati), non a
  // essere rifiutato. Il controllo vero sul tipo l'ha gia' fatto sniffContent.
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (!text.trim()) {
    throw badRequest('Il file è vuoto.');
  }

  return text;
};

const readCsvRows = (buffer: Buffer): ClientImportSource => {
  const text = decodeCsv(buffer);
  const delimiter = detectCsvDelimiter(text);

  try {
    return { format: 'csv', delimiter, rows: parseCsvRows(text, delimiter), dryRun: false };
  } catch (error) {
    throw badRequest('Il CSV non è leggibile: una virgoletta è rimasta aperta.', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
};

export const readClientImportFile = async (upload: ClientImportUpload): Promise<ClientImportSource> => {
  if (upload.buffer.length === 0) {
    throw badRequest('Il file è vuoto.');
  }

  const format = resolveFormat(
    readExtension(upload.filename),
    upload.mimeType,
    sniffContent(upload.buffer),
  );

  if (format === 'xlsx') {
    const sheet = await parseExcelBuffer(upload.buffer);

    return { format, delimiter: null, rows: sheetToRows(sheet), dryRun: upload.dryRun };
  }

  return { ...readCsvRows(upload.buffer), dryRun: upload.dryRun };
};

// @fastify/multipart fa scattare il tetto DURANTE la lettura dello stream, non
// prima: l'errore va intercettato dov'e' scritto il buffer, non all'ingresso.
// Stesso trattamento di sources.route.ts, che e' il precedente in casa.
const isTooLargeError = (error: unknown) =>
  error instanceof Error && /file too large|request file too large/i.test(error.message);

const isTooManyFilesError = (error: unknown) =>
  error instanceof Error && /files limit|reached files limit/i.test(error.message);

const readBooleanField = (value: unknown) => value === 'true' || value === '1';

export const readClientImportUpload = async (request: FastifyRequest): Promise<ClientImportUpload> => {
  let buffer: Buffer | null = null;
  let filename = '';
  let mimeType = '';
  let dryRun = false;

  try {
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        // Un solo file: il tetto `files: 1` e' gia' in app.ts. Se ne arriva un
        // secondo, il buffer del primo resta quello buono.
        if (buffer) {
          await part.toBuffer();
          continue;
        }
        buffer = await part.toBuffer();
        filename = part.filename ?? '';
        mimeType = part.mimetype ?? '';
        continue;
      }

      if (part.fieldname === 'dryRun') {
        dryRun = readBooleanField(part.value);
      }
    }
  } catch (error) {
    if (isTooLargeError(error)) {
      throw badRequest(`Il file supera il limite di ${MAX_IMPORT_FILE_LABEL}. Dividilo in più file e importali uno per volta.`);
    }
    if (isTooManyFilesError(error)) {
      throw badRequest('Carica un file per volta.');
    }
    throw error;
  }

  if (!buffer) {
    throw badRequest('Nessun file caricato.');
  }

  return { buffer, filename, mimeType, dryRun };
};
