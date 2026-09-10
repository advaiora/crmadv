import { describe, expect, it } from "vitest";
import { buildInitials, formatActivityTime, prettifyAction, resolveMobilePageTitle } from "./topNavFormatters";

describe("prettifyAction", () => {
  it("usa l'etichetta italiana quando l'azione e' nel catalogo", () => {
    expect(prettifyAction("quotes.create")).toBe("Preventivo creato");
  });

  it("torna un fallback leggibile per un'azione fuori catalogo", () => {
    expect(prettifyAction("something.custom")).toBe("something custom");
  });

  it("torna un fallback neutro per input vuoto o non testuale", () => {
    expect(prettifyAction("")).toBe("Attivita registrata");
    expect(prettifyAction(null)).toBe("Attivita registrata");
  });
});

describe("formatActivityTime", () => {
  it("formatta una data ISO valida in italiano", () => {
    expect(formatActivityTime("2026-09-10T14:30:00.000Z")).toMatch(/\d{2}\/\d{2}\/2026/);
  });

  it("torna stringa vuota per data assente o non valida", () => {
    expect(formatActivityTime("")).toBe("");
    expect(formatActivityTime("non-una-data")).toBe("");
  });
});

describe("buildInitials", () => {
  it("prende la prima lettera di due parole", () => {
    expect(buildInitials("Rita Neri")).toBe("RN");
  });

  it("prende le prime due lettere di una parola sola", () => {
    expect(buildInitials("Rita")).toBe("RI");
  });

  it("torna 'U' per input vuoto o non testuale", () => {
    expect(buildInitials("")).toBe("U");
    expect(buildInitials("   ")).toBe("U");
    expect(buildInitials(null)).toBe("U");
  });
});

describe("resolveMobilePageTitle", () => {
  it("riconosce i percorsi noti", () => {
    expect(resolveMobilePageTitle("/agency/123")).toBe("Produzione AI");
    expect(resolveMobilePageTitle("/apps/email")).toBe("Messaggi");
    expect(resolveMobilePageTitle("/")).toBe("Dashboard");
  });

  it("torna un fallback neutro per un percorso sconosciuto", () => {
    expect(resolveMobilePageTitle("/qualcosa/mai/visto")).toBe("CRM");
    expect(resolveMobilePageTitle("")).toBe("Dashboard");
  });
});
