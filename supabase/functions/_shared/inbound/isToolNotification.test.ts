import { describe, expect, it } from "vitest";

import { isToolNotification } from "./isToolNotification";

describe("isToolNotification", () => {
  it("herkent Trello aan het afzenderdomein", () => {
    expect(isToolNotification({ senderEmail: "do-not-reply@trello.com" })).toBe(
      true,
    );
    expect(
      isToolNotification({ senderEmail: "noreply@notifications.trello.com" }),
    ).toBe(true);
  });

  it("herkent een doorgestuurde notificatie aan de tekst", () => {
    // Precies de onderwerpen die opdracht 31 tot stortplaats maakten.
    for (const subject of [
      "Rick Maarssen heeft jou genoemd op de kaart [HAPPR] Google Reserve",
      "3 nieuwe notificaties op SEO - Online Matters",
      "Rick Maarssen heeft een opmerking geplaatst op Nieuwe lead",
      "John mentioned you on the card Website support",
    ]) {
      expect(
        isToolNotification({ senderEmail: "john@gmail.com", subject }),
      ).toBe(true);
    }
  });

  it("laat echte klantmail staan", () => {
    expect(
      isToolNotification({
        senderEmail: "anka@terschelling-recreatie.nl",
        subject: "Re: Website Terschelling Recreatie",
      }),
    ).toBe(false);
    expect(
      isToolNotification({
        senderEmail: "eline@studiocupido.nl",
        subject: "Minimale bestelwaarde",
      }),
    ).toBe(false);
  });

  it("valt niet over ontbrekende velden", () => {
    expect(isToolNotification({})).toBe(false);
    expect(isToolNotification({ senderEmail: null, subject: null })).toBe(
      false,
    );
    expect(isToolNotification({ senderEmail: "zonder-apenstaartje" })).toBe(
      false,
    );
  });
});
