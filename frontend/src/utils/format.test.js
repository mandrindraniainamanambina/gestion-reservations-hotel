import { describe, expect, it } from "vitest";
import { formatDate, formatMontant, nbNuits, nettoyerParams } from "./format.js";

describe("format", () => {
  it("calcule le nombre de nuits", () => {
    expect(nbNuits("2026-10-10", "2026-10-13")).toBe(3);
    expect(nbNuits("2026-10-13", "2026-10-10")).toBe(0);
    expect(nbNuits("", "2026-10-10")).toBe(0);
  });
  it("formate une date sans décalage de fuseau", () => {
    expect(formatDate("2026-10-05")).toBe("05/10/2026");
    expect(formatDate(null)).toBe("—");
  });
  it("formate un montant", () => {
    expect(formatMontant("abc")).toBe("—");
    expect(formatMontant(1500)).toContain("Ar");
  });
  it("retire les filtres vides", () => {
    expect(nettoyerParams({ a: "", b: "x", c: 0 })).toEqual({ b: "x", c: 0 });
  });
});
