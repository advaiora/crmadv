import { describe, expect, it } from "vitest";
import {
  buildImportOutcome,
  buildImportPreview,
  describeImportPreview,
  formatRowCount,
} from "./importSummary";

describe("formatRowCount", () => {
  it("dice «1 riga» al singolare e «N righe» al plurale", () => {
    expect(formatRowCount(1)).toBe("1 riga");
    expect(formatRowCount(0)).toBe("0 righe");
    expect(formatRowCount(12)).toBe("12 righe");
  });
});

describe("buildImportPreview", () => {
  it("riporta conteggi ed elenchi cosi' come arrivano", () => {
    const preview = buildImportPreview({
      totalRows: 3,
      validRows: 2,
      failedRows: 1,
      previewRows: [
        { row: 2, type: "person", name: "Mario Rossi", email: "m@r.it", phone: null },
        { row: 3, type: "company", name: "Acme", email: null, phone: "0212345" },
      ],
      errors: [{ row: 4, message: "email non valida" }],
    });

    expect(preview.totalRows).toBe(3);
    expect(preview.validRows).toBe(2);
    expect(preview.failedRows).toBe(1);
    expect(preview.rows).toHaveLength(2);
    expect(preview.errors).toHaveLength(1);
    expect(preview.hiddenRows).toBe(0);
    expect(preview.hiddenErrors).toBe(0);
  });

  // Il backend taglia i due elenchi a 100 elementi ma continua a contare: senza
  // questo conto l'anteprima prometterebbe 100 righe invece di 4.000.
  it("conta quante righe restano fuori dai due elenchi tagliati", () => {
    const preview = buildImportPreview({
      totalRows: 4200,
      validRows: 4000,
      failedRows: 200,
      previewRows: Array.from({ length: 100 }, (_, i) => ({ row: i + 2, name: `Cliente ${i}` })),
      errors: Array.from({ length: 100 }, (_, i) => ({ row: i + 2, message: "rotta" })),
    });

    expect(preview.hiddenRows).toBe(3900);
    expect(preview.hiddenErrors).toBe(100);
  });

  it("regge un riepilogo mancante o monco senza sbagliare per eccesso", () => {
    const vuoto = buildImportPreview(undefined);

    expect(vuoto.totalRows).toBe(0);
    expect(vuoto.validRows).toBe(0);
    expect(vuoto.rows).toEqual([]);
    expect(vuoto.errors).toEqual([]);
    expect(vuoto.hiddenRows).toBe(0);
    expect(vuoto.hiddenErrors).toBe(0);
  });

  it("non produce mai un conto di nascoste negativo", () => {
    // Se l'elenco fosse piu' lungo del conteggio (risposta incoerente), il
    // calcolo deve fermarsi a zero invece di scrivere «e altre -3 righe».
    const preview = buildImportPreview({
      validRows: 1,
      previewRows: [{ row: 2 }, { row: 3 }, { row: 4 }],
      failedRows: 0,
      errors: [{ row: 5, message: "x" }],
    });

    expect(preview.hiddenRows).toBe(0);
    expect(preview.hiddenErrors).toBe(0);
  });
});

describe("describeImportPreview", () => {
  it("senza scarti dice che non viene scartata nessuna riga", () => {
    const frase = describeImportPreview(buildImportPreview({ totalRows: 3, validRows: 3, failedRows: 0 }));

    expect(frase).toBe("Entrano 3 righe su 3. Nessuna riga viene scartata.");
  });

  it("con scarti dice quante entrano e quante restano fuori", () => {
    const frase = describeImportPreview(buildImportPreview({ totalRows: 50, validRows: 48, failedRows: 2 }));

    expect(frase).toBe("Entrano 48 righe su 50. 2 righe vengono scartate.");
  });

  it("al singolare accorda il verbo", () => {
    const frase = describeImportPreview(buildImportPreview({ totalRows: 2, validRows: 1, failedRows: 1 }));

    expect(frase).toBe("Entrano 1 riga su 2. 1 riga viene scartata.");
  });

  it("se non entra niente lo dice invece di annunciare zero righe", () => {
    const frase = describeImportPreview(buildImportPreview({ totalRows: 4, validRows: 0, failedRows: 4 }));

    expect(frase).toContain("Nessuna riga di questo file può entrare");
  });
});

describe("buildImportOutcome", () => {
  it("import pulito: variante success e conteggi nel testo", () => {
    const esito = buildImportOutcome({ createdRows: 3, failedRows: 0, totalRows: 3, errors: [] });

    expect(esito.variant).toBe("success");
    expect(esito.text).toBe("Import completato: 3 creati, 0 falliti su 3 righe.");
    expect(esito.errors).toEqual([]);
    expect(esito.hiddenErrors).toBe(0);
  });

  it("import con scarti: variante warning, cinque errori elencati e il resto contato", () => {
    const errors = Array.from({ length: 7 }, (_, i) => ({ row: i + 1, message: "riga rotta" }));
    const esito = buildImportOutcome({ createdRows: 1, failedRows: 7, totalRows: 8, errors });

    expect(esito.variant).toBe("warning");
    expect(esito.errors).toHaveLength(5);
    expect(esito.hiddenErrors).toBe(2);
  });

  it("risposta senza riepilogo: conteggi a zero, nessun crash", () => {
    const esito = buildImportOutcome(undefined);

    expect(esito.text).toBe("Import completato: 0 creati, 0 falliti su 0 righe.");
  });
});
