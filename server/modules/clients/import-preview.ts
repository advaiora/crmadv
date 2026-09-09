// La forma dell'anteprima: cosa la risposta racconta delle righe che
// entrerebbero, quando l'import gira in "prova senza salvare".
// Sta accanto a import-file.ts, e non dentro service.ts (oltre la soglia-mostro,
// e in questo giro non si spezza).

// L'elenco non e' infinito: un file da 20MB puo' portare decine di migliaia di
// righe, e rispedirle tutte farebbe una risposta piu' pesante del file. Il conto
// vero resta in `validRows`, quindi chi legge sa sempre quante ne restano fuori.
export const MAX_IMPORT_PREVIEW_ROWS = 100;

export type ClientImportPreviewRow = {
  row: number;
  type: string;
  name: string;
  email: string | null;
  phone: string | null;
};

// Gli stessi quattro dati che la lista clienti mostra in riga (nome, tipo,
// email, telefono): bastano a riconoscere un'anagrafica, e non trascinano
// indirizzo, note, tag e campi personalizzati dentro la risposta.
type ImportedRow = {
  row: number;
  payload: {
    type: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
};

export const buildImportPreviewRows = (
  validRows: readonly ImportedRow[],
): ClientImportPreviewRow[] =>
  validRows.slice(0, MAX_IMPORT_PREVIEW_ROWS).map((entry) => ({
    row: entry.row,
    type: entry.payload.type,
    name: entry.payload.name,
    email: entry.payload.email,
    phone: entry.payload.phone,
  }));
