import { describe, expect, it } from "vitest";
import { ApiError } from "../api/projects.api";
import {
  getErrorMessage,
  isInUseError,
  isLastStageError,
  normalizeStageRulesPayload,
  sortCategories,
  sortStages,
} from "./pipelineSettings.utils";

describe("sortCategories / sortStages", () => {
  const disordinate = [
    { name: "Zeta", sortOrder: 2 },
    { name: "Alfa" },
    { name: "Beta", sortOrder: 1 },
    { name: "alfa 2", sortOrder: "non-numero" },
  ];

  it("ordina per sortOrder crescente; senza sortOrder si finisce in coda", () => {
    const ordinate = sortCategories(disordinate).map((c) => c.name);
    expect(ordinate).toEqual(["Beta", "Zeta", "Alfa", "alfa 2"]);
  });

  it("a parita' di sortOrder ordina per nome (locale it) e non muta l'array di partenza", () => {
    const input = [
      { name: "Bravo", sortOrder: 1 },
      { name: "alfa", sortOrder: 1 },
    ];
    const ordinate = sortStages(input);
    expect(ordinate.map((s) => s.name)).toEqual(["alfa", "Bravo"]);
    expect(input.map((s) => s.name)).toEqual(["Bravo", "alfa"]);
  });
});

describe("getErrorMessage", () => {
  it("per gli errori API compone messaggio e codice (o status come ripiego)", () => {
    expect(getErrorMessage(new ApiError("Nome duplicato", { code: "IN_USE", status: 409 }))).toBe("Nome duplicato (IN_USE)");
    expect(getErrorMessage(new ApiError("Rotto", { status: 500 }))).toBe("Rotto (500)");
  });

  it("per errori generici usa il message, e stringa vuota senza errore", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage(null)).toBe("");
    expect(getErrorMessage({})).toBe("Errore inatteso");
  });
});

describe("isInUseError / isLastStageError", () => {
  it("riconoscono solo errori API col codice o status giusto", () => {
    expect(isInUseError(new ApiError("x", { code: "IN_USE" }))).toBe(true);
    expect(isInUseError(new ApiError("x", { status: 409 }))).toBe(true);
    expect(isInUseError(new ApiError("x", { status: 400 }))).toBe(false);
    expect(isInUseError(new Error("IN_USE"))).toBe(false);

    expect(isLastStageError(new ApiError("x", { code: "LAST_STAGE_REQUIRED" }))).toBe(true);
    expect(isLastStageError(new ApiError("x", { status: 400 }))).toBe(true);
    expect(isLastStageError(new Error("x"))).toBe(false);
  });
});

describe("normalizeStageRulesPayload", () => {
  it("accetta {items: []}, un array nudo, e torna [] per tutto il resto", () => {
    expect(normalizeStageRulesPayload({ items: [1, 2] })).toEqual([1, 2]);
    expect(normalizeStageRulesPayload([3])).toEqual([3]);
    expect(normalizeStageRulesPayload(null)).toEqual([]);
    expect(normalizeStageRulesPayload({ rules: [] })).toEqual([]);
  });
});
