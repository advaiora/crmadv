import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useClientsCsvTransfer } from "./useClientsCsvTransfer";
import { exportClients, importClients } from "./clientApi";

vi.mock("./clientApi", () => ({
  importClients: vi.fn(),
  exportClients: vi.fn(),
}));

const fintoFile = (contenuto) => ({ text: () => Promise.resolve(contenuto) });

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

  it("import riuscito: messaggio success coi conteggi e refresh via onImported", async () => {
    importClients.mockResolvedValueOnce({ summary: { createdRows: 3, failedRows: 0, totalRows: 3, errors: [] } });
    const onImported = vi.fn();
    const { result } = renderHook(() => useClientsCsvTransfer({ onImported }));

    await act(async () => result.current.importFromFile(fintoFile("csv")));

    expect(importClients).toHaveBeenCalledWith({ csv: "csv", dryRun: false });
    expect(result.current.actionMessage).toMatchObject({ variant: "success", text: "Import completato: 3 creati, 0 falliti su 3 righe." });
    expect(onImported).toHaveBeenCalled();
    expect(result.current.importing).toBe(false);
  });

  it("import con righe fallite: variant warning e anteprima errori (max 5)", async () => {
    const errors = Array.from({ length: 7 }, (_, i) => ({ row: i + 1, message: "riga rotta" }));
    importClients.mockResolvedValueOnce({ summary: { createdRows: 1, failedRows: 7, totalRows: 8, errors } });
    const { result } = renderHook(() => useClientsCsvTransfer());

    await act(async () => result.current.importFromFile(fintoFile("csv")));

    expect(result.current.actionMessage.variant).toBe("warning");
    expect(result.current.actionMessage.errors).toHaveLength(5);
  });

  it("import fallito: l'errore risale via onError e non resta nessun messaggio", async () => {
    importClients.mockRejectedValueOnce(new Error("csv illeggibile"));
    const onError = vi.fn();
    const { result } = renderHook(() => useClientsCsvTransfer({ onError }));

    await act(async () => result.current.importFromFile(fintoFile("csv")));

    expect(onError).toHaveBeenLastCalledWith("csv illeggibile");
    expect(result.current.actionMessage).toBe(null);
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

  it("import con risposta senza summary: conteggi a zero, nessun crash", async () => {
    importClients.mockResolvedValueOnce({});
    const { result } = renderHook(() => useClientsCsvTransfer());

    await act(async () => result.current.importFromFile(fintoFile("csv")));

    expect(result.current.actionMessage).toMatchObject({ variant: "success", text: "Import completato: 0 creati, 0 falliti su 0 righe." });
  });

  it("dismissMessage azzera il messaggio d'esito", async () => {
    importClients.mockResolvedValueOnce({ summary: { createdRows: 1, failedRows: 0, totalRows: 1, errors: [] } });
    const { result } = renderHook(() => useClientsCsvTransfer());
    await act(async () => result.current.importFromFile(fintoFile("csv")));
    expect(result.current.actionMessage).not.toBe(null);
    act(() => result.current.dismissMessage());
    expect(result.current.actionMessage).toBe(null);
  });
});
