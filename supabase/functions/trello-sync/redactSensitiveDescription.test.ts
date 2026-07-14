import { describe, expect, it } from "vitest";

import { redactSensitiveDescription } from "./redactSensitiveDescription.ts";

describe("redactSensitiveDescription", () => {
  it("redacts Dutch, English, Markdown and env-style credentials", () => {
    const input = [
      "# Inlog WordPress",
      "**Gebruikersnaam:** beheerder",
      "Wachtwoord: correct-horse-battery-staple",
      "- Password is another-secret",
      "API_TOKEN=token-value",
      "Gewone projecttekst blijft staan.",
    ].join("\n");

    expect(redactSensitiveDescription(input)).toBe(
      [
        "# Inlog WordPress",
        "Gebruikersnaam: [AFGESCHERMD]",
        "Wachtwoord: [AFGESCHERMD]",
        "- Password: [AFGESCHERMD]",
        "API_TOKEN=[AFGESCHERMD]",
        "Gewone projecttekst blijft staan.",
      ].join("\n"),
    );
  });

  it("redacts a credential value placed on the next line", () => {
    expect(
      redactSensitiveDescription("Wachtwoord\n\nzeer-geheim\nVolgende stap"),
    ).toBe("Wachtwoord: [AFGESCHERMD]\n\n[AFGESCHERMD]\nVolgende stap");
  });

  it("redacts credentials in URLs, query strings and authorization snippets", () => {
    const input =
      "Open https://admin:secret@example.com/?token=abc123 met Authorization: Bearer xyz.123";

    expect(redactSensitiveDescription(input)).toBe(
      "Open https://admin:[AFGESCHERMD]@example.com/?token=[AFGESCHERMD] met Authorization: Bearer [AFGESCHERMD]",
    );
  });

  it("replaces a full private-key block without leaking its body", () => {
    const input = [
      "Voor deployment:",
      "-----BEGIN PRIVATE KEY-----",
      "very-secret-key-body",
      "-----END PRIVATE KEY-----",
      "Gebruik de stagingserver.",
    ].join("\n");

    expect(redactSensitiveDescription(input)).toBe(
      [
        "Voor deployment:",
        "[PRIVATE KEY AFGESCHERMD]",
        "Gebruik de stagingserver.",
      ].join("\n"),
    );
  });

  it("preserves ordinary project text and is idempotent", () => {
    const input =
      "Toegang tot de WordPress-omgeving regelen.\nWebsite: https://example.com/admin";

    expect(redactSensitiveDescription(input)).toBe(input);
    expect(redactSensitiveDescription(redactSensitiveDescription(input))).toBe(
      input,
    );
  });
});
