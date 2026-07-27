import { describe, expect, it } from "vitest";

import type { Contact } from "../types";
import { isBypassingPartner, resolveCorrespondence } from "./correspondence";

const contact = (email?: string) =>
  ({
    id: 1,
    first_name: "Anka",
    last_name: "de Vries",
    email_jsonb: email ? [{ email, type: "Work" }] : [],
  }) as unknown as Contact;

describe("resolveCorrespondence", () => {
  it("kiest de klant zelf zolang er geen partner is ingevuld", () => {
    expect(
      resolveCorrespondence({ contacts: [contact("anka@klant.nl")] }),
    ).toEqual({ email: "anka@klant.nl", viaPartner: false });
  });

  it("kiest de partner en waarschuwt voor het adres van de klant", () => {
    const uitkomst = resolveCorrespondence({
      correspondenceEmail: "info@onlinematters.nl",
      contacts: [contact("anka@klant.nl")],
    });

    expect(uitkomst.email).toBe("info@onlinematters.nl");
    expect(uitkomst.viaPartner).toBe(true);
    expect(uitkomst.waarschuwing).toContain("info@onlinematters.nl");
    expect(uitkomst.waarschuwing).toContain("anka@klant.nl");
  });

  it("waarschuwt niet als de klant zelf de partner is", () => {
    // Verschil in hoofdletters of spaties is geen ander adres.
    expect(
      resolveCorrespondence({
        correspondenceEmail: " Info@OnlineMatters.nl ",
        contacts: [contact("info@onlinematters.nl")],
      }),
    ).toEqual({
      email: "info@onlinematters.nl",
      viaPartner: true,
      waarschuwing: undefined,
    });
  });

  it("negeert een waarde die geen adres is", () => {
    expect(
      resolveCorrespondence({
        correspondenceEmail: "via Rick bellen",
        contacts: [contact("anka@klant.nl")],
      }),
    ).toEqual({ email: "anka@klant.nl", viaPartner: false });
  });

  it("levert geen adres als er niets bekend is", () => {
    expect(resolveCorrespondence({})).toEqual({
      email: undefined,
      viaPartner: false,
    });
    expect(
      resolveCorrespondence({ contacts: [contact()] }).email,
    ).toBeUndefined();
  });
});

describe("isBypassingPartner", () => {
  it("herkent het aanschrijven van een eindklant", () => {
    expect(isBypassingPartner("info@onlinematters.nl", "anka@klant.nl")).toBe(
      true,
    );
  });

  it("is niet waar zonder partner of zonder doeladres", () => {
    expect(isBypassingPartner(null, "anka@klant.nl")).toBe(false);
    expect(isBypassingPartner("info@onlinematters.nl", undefined)).toBe(false);
    expect(
      isBypassingPartner("info@onlinematters.nl", "INFO@onlinematters.nl"),
    ).toBe(false);
  });
});
