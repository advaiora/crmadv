import { describe, expect, it } from "vitest";
import { hasTag } from "./helpers";

describe("hasTag", () => {
  it("trova il tag senza distinguere maiuscole e minuscole", () => {
    expect(hasTag(["Web", "Marketing"], "web")).toBe(true);
    expect(hasTag(["Web", "Marketing"], "MARKETING")).toBe(true);
  });

  it("torna false se il tag non c'e' o la lista e' vuota", () => {
    expect(hasTag(["Web"], "Social")).toBe(false);
    expect(hasTag([], "Web")).toBe(false);
  });

  it("torna false (senza esplodere) se tags non e' un array", () => {
    expect(hasTag(undefined, "Web")).toBe(false);
    expect(hasTag(null, "Web")).toBe(false);
  });
});
