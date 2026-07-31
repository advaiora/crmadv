import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useClientTagsEditor } from "./useClientTagsEditor";
import { updateClient } from "./clientApi";

vi.mock("./clientApi", () => ({
  updateClient: vi.fn(),
}));

const cliente = { id: "c1", name: "Trattoria Da Beppe", tags: ["Web", null, "Marketing"] };

describe("useClientTagsEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("open carica il cliente e i suoi tag (scartando i vuoti), azzerando bozza ed errore", () => {
    const { result } = renderHook(() => useClientTagsEditor());
    act(() => result.current.open(cliente));
    expect(result.current.client).toBe(cliente);
    expect(result.current.tags).toEqual(["Web", "Marketing"]);
    expect(result.current.draft).toBe("");
    expect(result.current.error).toBe("");
  });

  it("togglePreset aggiunge un tag assente e rimuove un tag presente (case-insensitive)", () => {
    const { result } = renderHook(() => useClientTagsEditor());
    act(() => result.current.open(cliente));
    act(() => result.current.togglePreset("Social"));
    expect(result.current.tags).toEqual(["Web", "Marketing", "Social"]);
    act(() => result.current.togglePreset("WEB"));
    expect(result.current.tags).toEqual(["Marketing", "Social"]);
  });

  it("addCustomTag aggiunge dalla bozza, non duplica (case-insensitive) e ignora la bozza vuota", () => {
    const { result } = renderHook(() => useClientTagsEditor());
    act(() => result.current.open(cliente));
    act(() => result.current.setDraft("  Ads  "));
    act(() => result.current.addCustomTag());
    expect(result.current.tags).toEqual(["Web", "Marketing", "Ads"]);
    expect(result.current.draft).toBe("");
    act(() => result.current.setDraft("marketing"));
    act(() => result.current.addCustomTag());
    expect(result.current.tags).toEqual(["Web", "Marketing", "Ads"]);
  });

  it("save aggiorna via API, avvisa onSaved e chiude", async () => {
    updateClient.mockResolvedValueOnce({});
    const onSaved = vi.fn();
    const { result } = renderHook(() => useClientTagsEditor({ onSaved }));
    act(() => result.current.open(cliente));
    act(() => result.current.togglePreset("Social"));
    await act(async () => result.current.save());
    expect(updateClient).toHaveBeenCalledWith("c1", { tags: ["Web", "Marketing", "Social"] });
    expect(onSaved).toHaveBeenCalledWith("c1", ["Web", "Marketing", "Social"]);
    expect(result.current.client).toBe(null);
    expect(result.current.saving).toBe(false);
  });

  it("se il salvataggio fallisce mostra l'errore e resta aperto", async () => {
    updateClient.mockRejectedValueOnce(new Error("rete giu'"));
    const { result } = renderHook(() => useClientTagsEditor());
    act(() => result.current.open(cliente));
    await act(async () => result.current.save());
    expect(result.current.error).toBe("rete giu'");
    expect(result.current.client).toBe(cliente);
    expect(result.current.saving).toBe(false);
  });

  it("close azzera tutto a riposo", () => {
    const { result } = renderHook(() => useClientTagsEditor());
    act(() => result.current.open(cliente));
    act(() => result.current.close());
    expect(result.current.client).toBe(null);
  });

  it("close viene rifiutata mentre sta salvando; con force chiude comunque", async () => {
    let resolveSave;
    updateClient.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    const { result } = renderHook(() => useClientTagsEditor());
    act(() => result.current.open(cliente));

    let savePromise;
    act(() => { savePromise = result.current.save(); });
    expect(result.current.saving).toBe(true);

    act(() => result.current.close());
    expect(result.current.client).toBe(cliente);

    act(() => result.current.close(true));
    expect(result.current.client).toBe(null);

    await act(async () => { resolveSave({}); await savePromise; });
    expect(result.current.saving).toBe(false);
  });
});
