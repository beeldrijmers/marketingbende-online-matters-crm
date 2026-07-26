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
  // Een geplakte bounce in de kaartomschrijving leverde "Mailer Daemon" op als
  // contactpersoon bij een echte klant, en de sync zette hem er elke ronde
  // opnieuw bij. De mens uit diezelfde bounce moet wel blijven staan.
  it("laat automatische afzenders uit een geplakte bounce buiten de contacten", () => {
    expect(
      extractTrelloContactEmails(`
        Bericht kon niet worden bezorgd.
        From: mailer-daemon@gw3.mail.uniserver.nl
        Aan: offeringaj@gmail.com
        Cc: no-reply@notificaties.example.com, bounce@example.org
      `),
    ).toEqual(["offeringaj@gmail.com"]);
  });
});
