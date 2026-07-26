import { describe, expect, it } from "vitest";

import { parseVaultLink, validateVaultLink } from "./vaultLink";

describe("parseVaultLink", () => {
  it("herkent een Bitwarden-item aan de host", () => {
    expect(
      parseVaultLink(
        "https://vault.bitwarden.com/#/vault?itemId=9f1c0b7e-1111-2222-3333-444455556666",
      ),
    ).toEqual({
      url: "https://vault.bitwarden.com/#/vault?itemId=9f1c0b7e-1111-2222-3333-444455556666",
      label: "Bitwarden",
    });
    expect(parseVaultLink("https://vault.bitwarden.eu/#/vault")?.label).toBe(
      "Bitwarden",
    );
  });

  it("valt terug op de host als de kluis onbekend is", () => {
    expect(parseVaultLink("https://kluis.example.org/item/7")?.label).toBe(
      "kluis.example.org",
    );
    // www hoort niet in een knoplabel.
    expect(parseVaultLink("https://www.kluis.example.org/item/7")?.label).toBe(
      "kluis.example.org",
    );
  });

  it("beschouwt leeg als leeg, niet als fout", () => {
    expect(parseVaultLink("")).toBeNull();
    expect(parseVaultLink("   ")).toBeNull();
    expect(parseVaultLink(null)).toBeNull();
    expect(parseVaultLink(undefined)).toBeNull();
    expect(validateVaultLink("")).toBeUndefined();
  });

  it("weigert alles wat geen https-link is", () => {
    // Een href met javascript: of data: is een openstaande deur, en http hoort
    // niet bij een kluis.
    expect(parseVaultLink("javascript:alert(1)")).toBeNull();
    expect(
      parseVaultLink("data:text/html,<script>alert(1)</script>"),
    ).toBeNull();
    expect(parseVaultLink("http://vault.bitwarden.com/#/vault")).toBeNull();
    expect(parseVaultLink("vault.bitwarden.com")).toBeNull();
    expect(parseVaultLink("wachtwoord: hunter2")).toBeNull();
  });
});

describe("validateVaultLink", () => {
  it("legt uit wat er moet staan", () => {
    expect(validateVaultLink("bitwarden")).toMatch(/https-link/);
    expect(
      validateVaultLink("https://vault.bitwarden.com/#/vault?itemId=abc"),
    ).toBeUndefined();
  });
});
