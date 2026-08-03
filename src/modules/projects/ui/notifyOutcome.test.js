import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "react-toastify";
import { notifyOutcome } from "./notifyOutcome";

vi.mock("react-toastify", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

beforeEach(() => {
  toast.error.mockReset();
  toast.success.mockReset();
});

describe("notifyOutcome", () => {
  it("una validazione ({attempted: false} CON errore) si vede: e' il ramo portante", () => {
    notifyOutcome({ attempted: false, error: "Nome categoria obbligatorio" }, "Creata");
    expect(toast.error).toHaveBeenCalledWith("Nome categoria obbligatorio");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("un fallimento dopo il tentativo mostra l'errore, mai il successo", () => {
    notifyOutcome({ attempted: true, error: "rete giu" }, "Creata");
    expect(toast.error).toHaveBeenCalledWith("rete giu");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("il successo annuncia il messaggio del chiamante, con le opzioni passate", () => {
    notifyOutcome({ attempted: true, error: "" }, "Salvato", { autoClose: 1300 });
    expect(toast.success).toHaveBeenCalledWith("Salvato", { autoClose: 1300 });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("non partito senza errore = silenzio totale", () => {
    notifyOutcome({ attempted: false, error: "" }, "Creata");
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
