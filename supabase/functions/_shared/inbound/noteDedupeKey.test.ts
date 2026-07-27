import { describe, expect, it } from "vitest";

import { noteDedupeKey, normaliseMessageId } from "./noteDedupeKey";

describe("noteDedupeKey", () => {
  it("geeft hetzelfde antwoord voor beide binnenkomstwegen", () => {
    // Dit is de hele reden: Resend en de Gmail-sync hebben elk hun eigen id, dus
    // hetzelfde bericht stond twee keer in het dossier.
    const messageId = "<CAF=abc123.def@mail.gmail.com>";

    const viaResend = noteDedupeKey({
      emailId: "3f7b0c1e-resend",
      headers: { "Message-ID": messageId },
    });
    const viaGmail = noteDedupeKey({
      emailId: "gmail:info@marketingbende.nl:18f2c",
      headers: [{ name: "Message-Id", value: messageId }],
    });

    expect(viaResend).toBe(viaGmail);
    expect(viaResend).toBe("msg:caf=abc123.def@mail.gmail.com");
  });

  it("valt terug op het provider-id als de header ontbreekt", () => {
    expect(noteDedupeKey({ emailId: "resend-1" })).toBe("resend-1");
    expect(noteDedupeKey({ emailId: "resend-1", headers: {} })).toBe(
      "resend-1",
    );
    expect(
      noteDedupeKey({ emailId: "resend-1", headers: { Subject: "Hallo" } }),
    ).toBe("resend-1");
  });

  it("negeert een waarde die geen Message-ID kan zijn", () => {
    // Zonder apenstaartje is de kans op botsing tussen klanten te groot.
    expect(
      noteDedupeKey({
        emailId: "resend-1",
        headers: { "Message-ID": "12345" },
      }),
    ).toBe("resend-1");
  });

  it("normaliseert punthaken, spaties en hoofdletters", () => {
    expect(normaliseMessageId("  <ABC@Example.COM>  ")).toBe("abc@example.com");
    expect(normaliseMessageId("abc@example.com")).toBe("abc@example.com");
    expect(normaliseMessageId("<<abc@example.com>>")).toBe("abc@example.com");
    expect(normaliseMessageId("geen-adres")).toBeNull();
  });
});
