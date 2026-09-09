import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useClientsCsvTransfer } from "./useClientsCsvTransfer";
import { exportClients, importClients } from "./clientApi";

vi.mock("./clientApi", () => ({
  importClients: vi.fn(),
  exportClients: vi.fn(),
}));

// Un file vero (non piu' un finto oggetto con `.text()`): adesso il file viene
// passato tal quale a FormData, e non letto come testo — un .xlsx e' binario.
const fintoFile = (nome = "clienti.csv") => new File(["nome\nRossi"], nome, { type: "text/csv" });

const rispostaAnteprima = (extra = {}) => ({
  summary: {
    dryRun: true,
    totalRows: 3,
    validRows: 2,
    failedRows: 1,
    previewRows: [
      { row: 2, type: "person", name: "Mario Rossi", email: "m@r.it", phone: null },
      { row: 3, type: "company", name: "Acme", email: null, phone: "0212345" },
    ],
    errors: [{ row: 4, message: "email non valida" }],
    ...extra,
  },
});

// jsdom non implementa createObjectURL: per i test di export va sostituito.
const stubUrl = () => {
  const createObjectURL = vi.fn(() => "blob:finto");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  return { createObjectURL, revokeObjectURL };
};

describe("useClientsCsvTransfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Il ripristino sta qui (non in coda ai test): se un'asserzione fallisce,
  // il global URL torna comunque quello vero e non inquina i test successivi.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("l'anteprima non salva", () => {
    // ⚠️ Questo e' il test che protegge il punto in cui questo lavoro potrebbe
    // fare danno vero: un'anteprima che scrive e' peggio di nessuna anteprima.
    it("chiedere l'anteprima chiama l'import in prova senza salvare, una volta sola", async () => {
      importClients.mockResolvedValueOnce(rispostaAnteprima());
      const onImported = vi.fn();
      const { result } = renderHook(() => useClientsCsvTransfer({ onImported }));
      const file = fintoFile();

      await act(async () => result.current.requestPreview(file));

      expect(importClients).toHaveBeenCalledTimes(1);
      expect(importClients).toHaveBeenCalledWith(file, { dryRun: true });
      // Nessuna chiamata con dryRun false: niente e' stato salvato.
      expect(importClients).not.toHaveBeenCalledWith(file, { dryRun: false });
      // E la lista non viene ricaricata, perche' non e' cambiato niente.
      expect(onImported).not.toHaveBeenCalled();
      expect(result.current.actionMessage).toBe(null);
    });

    it("annullare l'anteprima non chiama nessun import e non lascia messaggi", async () => {
      importClients.mockResolvedValueOnce(rispostaAnteprima());
      const onImported = vi.fn();
      const { result } = renderHook(() => useClientsCsvTransfer({ onImported }));

      await act(async () => result.current.requestPreview(fintoFile()));
      act(() => result.current.cancelPreview());

      expect(result.current.preview).toBe(null);
      expect(importClients).toHaveBeenCalledTimes(1);
      expect(onImported).not.toHaveBeenCalled();
      expect(result.current.actionMessage).toBe(null);
    });

    it("confermare senza aver prima chiesto l'anteprima non chiama niente", async () => {
      const { result } = renderHook(() => useClientsCsvTransfer());

      await act(async () => result.current.confirmImport());

      expect(importClients).not.toHaveBeenCalled();
    });
  });

  it("l'anteprima riuscita espone conteggi, righe e scarti, e tiene il file", async () => {
    importClients.mockResolvedValueOnce(rispostaAnteprima());
    const { result } = renderHook(() => useClientsCsvTransfer());
    const file = fintoFile("anagrafica.xlsx");

    await act(async () => result.current.requestPreview(file));

    expect(result.current.preview).toMatchObject({ totalRows: 3, validRows: 2, failedRows: 1 });
    expect(result.current.preview.rows).toHaveLength(2);
    expect(result.current.preview.errors).toEqual([{ row: 4, message: "email non valida" }]);
    expect(result.current.preview.file).toBe(file);
    expect(result.current.previewing).toBe(false);
  });

  it("l'anteprima fallita risale via onError e non apre nessuna anteprima", async () => {
    importClients.mockRejectedValueOnce(new Error("Il file è vuoto."));
    const onError = vi.fn();
    const { result } = renderHook(() => useClientsCsvTransfer({ onError }));

    await act(async () => result.current.requestPreview(fintoFile()));

    expect(onError).toHaveBeenLastCalledWith("Il file è vuoto.");
    expect(result.current.preview).toBe(null);
    expect(result.current.previewing).toBe(false);
  });

  it("la conferma importa lo stesso file dell'anteprima, questa volta salvando", async () => {
    importClients
      .mockResolvedValueOnce(rispostaAnteprima())
      .mockResolvedValueOnce({ summary: { createdRows: 2, failedRows: 1, totalRows: 3, errors: [{ row: 4, message: "email non valida" }] } });
    const onImported = vi.fn();
    const { result } = renderHook(() => useClientsCsvTransfer({ onImported }));
    const file = fintoFile();

    await act(async () => result.current.requestPreview(file));
    await act(async () => result.current.confirmImport());

    expect(importClients).toHaveBeenNthCalledWith(2, file, { dryRun: false });
    expect(result.current.actionMessage).toMatchObject({
      variant: "warning",
      text: "Import completato: 2 creati, 1 falliti su 3 righe.",
    });
    expect(onImported).toHaveBeenCalled();
    // L'anteprima si chiude da sola: quel file e' stato consumato.
    expect(result.current.preview).toBe(null);
    expect(result.current.importing).toBe(false);
  });

  it("se la conferma fallisce l'anteprima resta aperta, per poter riprovare", async () => {
    importClients
      .mockResolvedValueOnce(rispostaAnteprima())
      .mockRejectedValueOnce(new Error("connessione persa"));
    const onError = vi.fn();
    const { result } = renderHook(() => useClientsCsvTransfer({ onError }));

    await act(async () => result.current.requestPreview(fintoFile()));
    await act(async () => result.current.confirmImport());

    expect(onError).toHaveBeenLastCalledWith("connessione persa");
    expect(result.current.preview).not.toBe(null);
    expect(result.current.importing).toBe(false);
  });

  it("export riuscito: scarica il blob e lascia il messaggio col nome file", async () => {
    exportClients.mockResolvedValueOnce({ blob: new Blob(["dati"]), filename: "clienti.csv" });
    const { createObjectURL, revokeObjectURL } = stubUrl();

    const { result } = renderHook(() => useClientsCsvTransfer());
    await act(async () => result.current.exportWithFilters({ sort: "-updatedAt" }));

    expect(exportClients).toHaveBeenCalledWith({ sort: "-updatedAt" });
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:finto");
    expect(result.current.actionMessage.text).toContain("clienti.csv");
    expect(result.current.exporting).toBe(false);
  });

  it("un secondo export mentre il primo e' in corso viene ignorato", async () => {
    let resolveExport;
    exportClients.mockReturnValueOnce(new Promise((resolve) => { resolveExport = resolve; }));
    stubUrl();

    const { result } = renderHook(() => useClientsCsvTransfer());
    let primaChiamata;
    act(() => { primaChiamata = result.current.exportWithFilters({}); });
    expect(result.current.exporting).toBe(true);

    await act(async () => result.current.exportWithFilters({}));
    expect(exportClients).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveExport({ blob: new Blob(["x"]), filename: "f.csv" });
      await primaChiamata;
    });
    expect(result.current.exporting).toBe(false);
  });

  it("anteprima con risposta senza summary: conteggi a zero, nessun crash", async () => {
    importClients.mockResolvedValueOnce({});
    const { result } = renderHook(() => useClientsCsvTransfer());

    await act(async () => result.current.requestPreview(fintoFile()));

    expect(result.current.preview).toMatchObject({ totalRows: 0, validRows: 0, failedRows: 0 });
  });

  it("dismissMessage azzera il messaggio d'esito", async () => {
    importClients
      .mockResolvedValueOnce(rispostaAnteprima())
      .mockResolvedValueOnce({ summary: { createdRows: 1, failedRows: 0, totalRows: 1, errors: [] } });
    const { result } = renderHook(() => useClientsCsvTransfer());

    await act(async () => result.current.requestPreview(fintoFile()));
    await act(async () => result.current.confirmImport());
    expect(result.current.actionMessage).not.toBe(null);

    act(() => result.current.dismissMessage());
    expect(result.current.actionMessage).toBe(null);
  });
});
