import { describe, expect, it } from "vitest";
import { newestUnreadIncomingAt } from "./chatShared";

// Funzione che decide se chiedere "segna come letto": e' lei a tenere il Registro
// attivita' pulito, quindi i casi limite si verificano qui, non a schermo.
describe("newestUnreadIncomingAt", () => {
  const incoming = { isMine: false, readAt: null, createdAt: "2026-09-09T10:00:00.000Z" };

  it("torna 0 quando non c'e' niente da leggere", () => {
    expect(newestUnreadIncomingAt([])).toBe(0);
    expect(newestUnreadIncomingAt(undefined)).toBe(0);
    expect(newestUnreadIncomingAt(null)).toBe(0);
  });

  it("ignora i messaggi gia' letti", () => {
    expect(newestUnreadIncomingAt([{ ...incoming, readAt: "2026-09-09T10:01:00.000Z" }])).toBe(0);
  });

  it("ignora i propri messaggi, anche se non letti dall'altro", () => {
    expect(newestUnreadIncomingAt([{ ...incoming, isMine: true }])).toBe(0);
  });

  it("torna l'istante del piu' recente fra i non letti in arrivo", () => {
    const items = [
      { ...incoming, createdAt: "2026-09-09T10:00:00.000Z" },
      { ...incoming, createdAt: "2026-09-09T12:30:00.000Z" },
      { ...incoming, createdAt: "2026-09-09T11:00:00.000Z" },
    ];
    expect(newestUnreadIncomingAt(items)).toBe(Date.parse("2026-09-09T12:30:00.000Z"));
  });

  it("non si fa ingannare da date assenti o illeggibili", () => {
    expect(newestUnreadIncomingAt([{ isMine: false, readAt: null }])).toBe(0);
    expect(newestUnreadIncomingAt([{ ...incoming, createdAt: "non-una-data" }])).toBe(0);
    expect(newestUnreadIncomingAt([null, undefined, incoming])).toBe(
      Date.parse("2026-09-09T10:00:00.000Z"),
    );
  });
});
