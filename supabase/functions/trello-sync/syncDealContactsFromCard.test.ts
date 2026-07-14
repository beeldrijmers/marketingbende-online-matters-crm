import {
  contactNameFromEmail,
  extractTrelloContactEmails,
} from "./extractTrelloContacts.ts";

describe("Trello contact enrichment", () => {
  it("extracts unique external contact emails and ignores team accounts", () => {
    expect(
      extractTrelloContactEmails(`
        Contact: jan.de.vries@klant.nl
        Login: INFO@KLANT.NL
        Intern: rick@marketingbende.nl
        Nogmaals: jan.de.vries@klant.nl
      `),
    ).toEqual(["jan.de.vries@klant.nl", "info@klant.nl"]);
  });

  it("derives readable names without inventing a person for shared aliases", () => {
    expect(contactNameFromEmail("jan.de-vries@klant.nl", "Klant BV")).toEqual({
      firstName: "Jan",
      lastName: "De Vries",
    });
    expect(contactNameFromEmail("info@klant.nl", "Klant BV")).toEqual({
      firstName: "Klant BV",
      lastName: "",
    });
  });
});
