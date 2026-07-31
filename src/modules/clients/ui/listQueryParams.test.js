import { describe, expect, it } from "vitest";
import { getSortLabel, parsePageSize, parsePositiveInt, parseSort, parseType } from "./listQueryParams";
import { CLIENTS_PAGE_SIZE_OPTIONS } from "./constants";

describe("parsePositiveInt", () => {
  it("accetta interi positivi (anche come stringa di querystring)", () => {
    expect(parsePositiveInt("3", 1)).toBe(3);
    expect(parsePositiveInt(7, 1)).toBe(7);
  });

  it("torna il fallback per zero, negativi, decimali e non-numeri", () => {
    expect(parsePositiveInt("0", 1)).toBe(1);
    expect(parsePositiveInt("-2", 1)).toBe(1);
    expect(parsePositiveInt("2.5", 1)).toBe(1);
    expect(parsePositiveInt("abc", 1)).toBe(1);
    expect(parsePositiveInt(null, 5)).toBe(5);
    expect(parsePositiveInt(undefined, 5)).toBe(5);
  });
});

describe("parseSort", () => {
  it("accetta i valori del catalogo ordinamenti", () => {
    expect(parseSort("name")).toBe("name");
    expect(parseSort("-name")).toBe("-name");
    expect(parseSort("-updatedAt")).toBe("-updatedAt");
  });

  it("ripiega su -updatedAt per valori sconosciuti o assenti", () => {
    expect(parseSort("email")).toBe("-updatedAt");
    expect(parseSort(null)).toBe("-updatedAt");
    expect(parseSort("")).toBe("-updatedAt");
  });
});

describe("parseType", () => {
  it("accetta solo person e company", () => {
    expect(parseType("person")).toBe("person");
    expect(parseType("company")).toBe("company");
  });

  it("ripiega su all per tutto il resto", () => {
    expect(parseType("azienda")).toBe("all");
    expect(parseType(null)).toBe("all");
    expect(parseType("all")).toBe("all");
  });
});

describe("parsePageSize", () => {
  it("accetta solo le dimensioni previste dal catalogo", () => {
    for (const size of CLIENTS_PAGE_SIZE_OPTIONS) {
      expect(parsePageSize(String(size))).toBe(size);
    }
  });

  it("ripiega sulla prima dimensione per valori fuori catalogo", () => {
    expect(parsePageSize("33")).toBe(CLIENTS_PAGE_SIZE_OPTIONS[0]);
    expect(parsePageSize("-1")).toBe(CLIENTS_PAGE_SIZE_OPTIONS[0]);
    expect(parsePageSize(null)).toBe(CLIENTS_PAGE_SIZE_OPTIONS[0]);
  });
});

describe("getSortLabel", () => {
  it("torna la label del valore di ordinamento", () => {
    expect(getSortLabel("name")).toBe("Nome A-Z");
  });

  it("ripiega sulla label di default per valori sconosciuti", () => {
    expect(getSortLabel("boh")).toBe("Aggiornati di recente");
  });
});
