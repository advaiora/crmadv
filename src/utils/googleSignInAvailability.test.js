import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../lib/apiFetch";
import { fetchGoogleSignInAvailability } from "./googleSignInAvailability";

vi.mock("../lib/apiFetch", () => ({
  apiFetch: vi.fn(),
}));

const rispostaJson = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("fetchGoogleSignInAvailability", () => {
  it("torna true quando il backend segnala GOOGLE_CLIENT_ID configurato", async () => {
    apiFetch.mockResolvedValue(rispostaJson(200, { ok: true, googleClientIdConfigured: true }));

    await expect(fetchGoogleSignInAvailability()).resolves.toBe(true);
    expect(apiFetch).toHaveBeenCalledWith("/auth/google/health", { method: "GET", skipAuthHeaders: true });
  });

  it("torna false quando il backend segnala GOOGLE_CLIENT_ID assente", async () => {
    apiFetch.mockResolvedValue(rispostaJson(200, { ok: true, googleClientIdConfigured: false }));

    await expect(fetchGoogleSignInAvailability()).resolves.toBe(false);
  });

  it("torna false se la risposta HTTP non e' ok", async () => {
    apiFetch.mockResolvedValue(rispostaJson(500, {}));

    await expect(fetchGoogleSignInAvailability()).resolves.toBe(false);
  });

  it("torna false se la richiesta va in errore (rete assente, JSON malformato...)", async () => {
    apiFetch.mockRejectedValue(new Error("rete assente"));

    await expect(fetchGoogleSignInAvailability()).resolves.toBe(false);
  });
});
