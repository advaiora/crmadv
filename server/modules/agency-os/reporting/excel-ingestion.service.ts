import { badRequest } from '../../../core/errors.js';
import { runAgencyOpenAiJsonWithMeta } from '../agency.service.js';
import { performanceReportingService } from './performance.service.js';
import { parseExcelBuffer, type ParsedSheet } from './excel-parser.js';

// Ingestion Excel del modulo Reportistica (sotto-modulo Excel+AI, V6).
// Prima slice: file cliente -> l'AI PROPONE la mappatura (structured output) ->
// il codice applica la mappatura in modo DETERMINISTICO (parsing all'italiana,
// aggregazione per mese) -> anteprima + riconciliazione record-in/record-out ->
// (in commit) scrittura di uno o piu' PerformanceSnapshot source=EXCEL.
// Principio (da report-multisorgente-decisioni.md): l'AI decide COSA fare, il
// codice lo ESEGUE; il serbatoio cattura tutto il grezzo (metrics = JSON libero).
// NB: mini-chat (4 famiglie di direttive) e profilo versionato = fase successiva
// (quella con migrazione), NON qui.

const SAMPLE_ROWS_FOR_AI = 8;
const MAX_ROWS = 50_000;

export interface ExcelMapping {
  rowMeaning: string;
  dateColumn: string | null;
  valueColumn: string | null;
  sourceColumn: string | null;
  dateFormat: string;
  decimalSeparator: string;
  thousandsSeparator: string;
  notes?: string;
}

// Lo SCHEMA guida la generazione: elenca davvero i campi (nota #32, altrimenti Claude
// torna un oggetto vuoto). Chiediamo i nomi ESATTI delle intestazioni.
const MAPPING_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    rowMeaning: {
      type: 'string',
      description: 'Cosa rappresenta UNA riga del foglio (es. "lead", "transazione", "appuntamento", "contatto").',
    },
    dateColumn: {
      type: 'string',
      description: 'Nome ESATTO della colonna con la DATA della singola riga. Stringa vuota se assente.',
    },
    valueColumn: {
      type: 'string',
      description: 'Nome ESATTO della colonna col VALORE economico/importo/fatturato della riga. Stringa vuota se assente.',
    },
    sourceColumn: {
      type: 'string',
      description: 'Nome ESATTO della colonna con la SORGENTE/canale (es. fb, ig, google). Stringa vuota se assente.',
    },
    dateFormat: {
      type: 'string',
      description: 'Formato della data osservato, es. "DD/MM/YYYY" o "YYYY-MM-DD".',
    },
    decimalSeparator: {
      type: 'string',
      description: 'Separatore decimale degli importi: "," (italiano) o ".".',
    },
    thousandsSeparator: {
      type: 'string',
      description: 'Separatore delle migliaia: "." (italiano), "," oppure "" se assente.',
    },
    notes: {
      type: 'string',
      description: 'Note brevi sulla lettura del file (max una frase).',
    },
  },
  required: ['rowMeaning', 'dateColumn', 'valueColumn', 'dateFormat', 'decimalSeparator', 'thousandsSeparator'],
};

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

const toIsoDay = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseItalianNumber = (raw: unknown, decimalSep = ',', thousandsSep = '.'): number => {
  if (typeof raw === 'number') {
    return raw;
  }
  if (raw === null || raw === undefined) {
    return 0;
  }
  let text = String(raw).trim();
  if (!text) {
    return 0;
  }
  // Tiene solo cifre, separatori e segno; via simboli di valuta e spazi.
  text = text.replace(/[^\d.,-]/g, '');
  if (thousandsSep) {
    text = text.split(thousandsSep).join('');
  }
  if (decimalSep && decimalSep !== '.') {
    text = text.split(decimalSep).join('.');
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : 0;
};

export const parseDateValue = (raw: unknown): Date | null => {
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  const text = String(raw ?? '').trim();
  if (!text) {
    return null;
  }
  // Formato all'italiana GG/MM/AAAA (o GG-MM-AAAA, GG.MM.AAAA; anno a 2 o 4 cifre).
  const italian = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (italian) {
    let year = Number(italian[3]);
    if (year < 100) {
      year += 2000;
    }
    const date = new Date(year, Number(italian[2]) - 1, Number(italian[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // Formato ISO AAAA-MM-GG.
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const asColumn = (value: unknown, headers: string[]): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed && headers.includes(trimmed) ? trimmed : null;
};

// Mappatura euristica di ripiego: indovina le colonne dai nomi delle intestazioni.
// Usata se l'AI non e' configurata o restituisce qualcosa di inservibile.
const heuristicMapping = (headers: string[]): ExcelMapping => {
  const find = (regex: RegExp) => headers.find((header) => regex.test(header)) ?? null;
  return {
    rowMeaning: 'riga',
    dateColumn: find(/data|date/i),
    valueColumn: find(/valore|importo|fatturat|ricav|amount|value|revenue/i),
    sourceColumn: find(/source|sorgent|canale|channel|provenien/i),
    dateFormat: 'DD/MM/YYYY',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  };
};

const normalizeMapping = (raw: unknown, headers: string[]): ExcelMapping => {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const heuristic = heuristicMapping(headers);
  const decimal = typeof record.decimalSeparator === 'string' && record.decimalSeparator ? record.decimalSeparator : ',';
  const thousands = typeof record.thousandsSeparator === 'string' ? record.thousandsSeparator : '.';
  return {
    rowMeaning: typeof record.rowMeaning === 'string' && record.rowMeaning.trim() ? record.rowMeaning.trim() : 'riga',
    dateColumn: asColumn(record.dateColumn, headers) ?? heuristic.dateColumn,
    valueColumn: asColumn(record.valueColumn, headers) ?? heuristic.valueColumn,
    sourceColumn: asColumn(record.sourceColumn, headers) ?? heuristic.sourceColumn,
    dateFormat: typeof record.dateFormat === 'string' && record.dateFormat ? record.dateFormat : 'DD/MM/YYYY',
    decimalSeparator: decimal,
    thousandsSeparator: thousands,
    notes: typeof record.notes === 'string' ? record.notes : undefined,
  };
};

const proposeMapping = async (input: {
  workspaceId: string;
  projectId: string;
  headers: string[];
  sampleRows: Array<Record<string, unknown>>;
}): Promise<{ mapping: ExcelMapping; mode: 'ai_structured' | 'fallback_rule_based' }> => {
  const system =
    'Sei un assistente che standardizza fogli Excel NON standard forniti dai clienti di ' +
    "un'agenzia di marketing. Ti do le intestazioni di colonna e alcune righe campione. " +
    'Individua: cosa rappresenta UNA riga; la colonna con la DATA della riga; la colonna ' +
    'col VALORE economico (importo/fatturato); la colonna con la SORGENTE/canale; e le ' +
    'regole di lettura (formato data, separatori numerici all\'italiana). Usa SEMPRE i nomi ' +
    'ESATTI delle intestazioni fornite; stringa vuota se una colonna non esiste.';

  let result: Awaited<ReturnType<typeof runAgencyOpenAiJsonWithMeta>> = null;
  try {
    result = await runAgencyOpenAiJsonWithMeta({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      system,
      user: { headers: input.headers, sampleRows: input.sampleRows },
      functionName: 'reporting.excelMapping',
      jsonSchema: MAPPING_JSON_SCHEMA,
    });
  } catch (_error) {
    result = null;
  }

  const payload = (result?.payload ?? null) as Record<string, unknown> | null;
  // Un payload valido deve almeno riconoscere una colonna data che esiste davvero.
  if (payload && asColumn((payload as Record<string, unknown>).dateColumn, input.headers)) {
    return { mapping: normalizeMapping(payload, input.headers), mode: 'ai_structured' };
  }
  return { mapping: heuristicMapping(input.headers), mode: 'fallback_rule_based' };
};

export interface ExcelSnapshotDraft {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  metrics: Record<string, number>;
}

export interface ExcelReconciliation {
  rowsParsed: number;
  rowsBucketed: number;
  rowsSkippedNoDate: number;
  balanced: boolean;
  months: number;
}

// Applica la mappatura in modo deterministico: raggruppa per mese e calcola le
// metriche. La riconciliazione (righe entrate = righe conteggiate + scartate) e' il
// freno all'errore silenzioso, ripreso dal metodo del progetto Revisioni.
export const applyMapping = (
  parsed: ParsedSheet,
  mapping: ExcelMapping,
): { snapshots: ExcelSnapshotDraft[]; reconciliation: ExcelReconciliation } => {
  type Bucket = { year: number; month: number; leads: number; conversions: number; conversionValue: number; bySource: Map<string, number> };
  const buckets = new Map<string, Bucket>();
  let skippedNoDate = 0;

  for (const row of parsed.rows) {
    const date = mapping.dateColumn ? parseDateValue(row[mapping.dateColumn]) : null;
    if (!date) {
      skippedNoDate += 1;
      continue;
    }
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { year: date.getFullYear(), month: date.getMonth(), leads: 0, conversions: 0, conversionValue: 0, bySource: new Map() };
      buckets.set(key, bucket);
    }
    bucket.leads += 1;
    const value = mapping.valueColumn
      ? parseItalianNumber(row[mapping.valueColumn], mapping.decimalSeparator, mapping.thousandsSeparator)
      : 0;
    if (value > 0) {
      bucket.conversions += 1;
      bucket.conversionValue += value;
    }
    if (mapping.sourceColumn) {
      const rawSource = String(row[mapping.sourceColumn] ?? '').trim().toLowerCase();
      const source = rawSource && rawSource !== 'none' ? rawSource : 'non tracciato';
      bucket.bySource.set(source, (bucket.bySource.get(source) ?? 0) + 1);
    }
  }

  const snapshots: ExcelSnapshotDraft[] = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, bucket]) => {
      const metrics: Record<string, number> = {
        leads: bucket.leads,
        conversions: bucket.conversions,
        conversionValue: round2(bucket.conversionValue),
        conversionRate: bucket.leads > 0 ? round4(bucket.conversions / bucket.leads) : 0,
        aov: bucket.conversions > 0 ? round2(bucket.conversionValue / bucket.conversions) : 0,
      };
      bucket.bySource.forEach((count, source) => {
        metrics[`leads_${source.replace(/\s+/g, '_')}`] = count;
      });
      return {
        periodKey: key,
        periodStart: toIsoDay(new Date(bucket.year, bucket.month, 1)),
        periodEnd: toIsoDay(new Date(bucket.year, bucket.month + 1, 0)),
        metrics,
      };
    });

  const rowsBucketed = snapshots.reduce((sum, snapshot) => sum + Number(snapshot.metrics.leads), 0);
  return {
    snapshots,
    reconciliation: {
      rowsParsed: parsed.rows.length,
      rowsBucketed,
      rowsSkippedNoDate: skippedNoDate,
      balanced: rowsBucketed + skippedNoDate === parsed.rows.length,
      months: snapshots.length,
    },
  };
};

const ensureParsable = (parsed: ParsedSheet) => {
  if (parsed.rowCount === 0) {
    throw badRequest('Il foglio non contiene righe dati.');
  }
  if (parsed.rowCount > MAX_ROWS) {
    throw badRequest(`Il foglio ha troppe righe (${parsed.rowCount}); massimo ${MAX_ROWS}.`);
  }
};

export const excelIngestionService = {
  // Anteprima: propone la mappatura e mostra cosa verrebbe scritto, SENZA scrivere.
  async preview(input: { workspaceId: string; projectId: string; buffer: Buffer; filename: string }) {
    const parsed = await parseExcelBuffer(input.buffer);
    ensureParsable(parsed);
    const sampleRows = parsed.rows.slice(0, SAMPLE_ROWS_FOR_AI);
    const { mapping, mode } = await proposeMapping({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      headers: parsed.headers,
      sampleRows,
    });
    const { snapshots, reconciliation } = applyMapping(parsed, mapping);
    // Anti-doppione: segnala quali mesi sono gia' presenti nel serbatoio (fonte
    // EXCEL), cosi' l'anteprima avvisa prima di duplicare i totali.
    const existingPeriods = await performanceReportingService.findExistingProjectPeriods({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      source: 'EXCEL',
      periodStarts: snapshots.map((snapshot) => snapshot.periodStart),
    });
    return {
      filename: input.filename,
      sheetName: parsed.sheetName,
      headers: parsed.headers,
      sampleRows,
      rowCount: parsed.rowCount,
      mapping,
      mappingMode: mode,
      preview: { snapshots, reconciliation, existingPeriods },
    };
  },

  // Commit: applica la mappatura (eventualmente corretta dall'utente) e SCRIVE gli
  // snapshot nel serbatoio in un'unica transazione (o tutti o nessuno). Con
  // replace=true sostituisce i mesi gia' presenti invece di duplicarli.
  async commit(input: {
    workspaceId: string;
    projectId: string;
    userId: string | null;
    buffer: Buffer;
    filename: string;
    mapping: unknown;
    replace: boolean;
  }) {
    const parsed = await parseExcelBuffer(input.buffer);
    ensureParsable(parsed);
    const mapping = normalizeMapping(input.mapping, parsed.headers);
    const { snapshots, reconciliation } = applyMapping(parsed, mapping);
    if (snapshots.length === 0) {
      throw badRequest('Nessuna rilevazione ricavabile: controlla la colonna della data e il formato.');
    }

    const { created, replaced } = await performanceReportingService.commitExcelSnapshots({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      userId: input.userId,
      // Troncato al limite della colonna (VarChar 160) per non far fallire il
      // commit con un 400 generico su nomi file molto lunghi.
      sourceLabel: `Excel: ${input.filename}`.slice(0, 160),
      contextEvent: mapping.rowMeaning ? `Import ${mapping.rowMeaning}` : null,
      tags: ['excel'],
      snapshots: snapshots.map((snapshot) => ({
        periodStart: snapshot.periodStart,
        periodEnd: snapshot.periodEnd,
        metrics: snapshot.metrics,
      })),
      replace: input.replace,
    });

    return { filename: input.filename, created: created.length, replaced, snapshots: created, mapping, reconciliation };
  },
};
