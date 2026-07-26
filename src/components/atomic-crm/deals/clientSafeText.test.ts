import {
  clientSafeLines,
  describeWork,
  isClientSafeLine,
} from "./clientSafeText";

const team = ["John Plantenga", "Rick Maarssen"];

describe("isClientSafeLine", () => {
  it("blocks the line that started all this", () => {
    expect(
      isClientSafeLine(
        "Rick belt de heer Mohammed Nadi via +31 6 50610409 voor introductie",
        team,
      ),
    ).toBe(false);
  });

  it("blocks our own sales strategy and go/no-go", () => {
    expect(
      isClientSafeLine(
        "Doelaccounts en beslissers bepalen, waaronder Elkien en WoonFriesland",
        team,
      ),
    ).toBe(false);
    expect(
      isClientSafeLine(
        "Rick beoordeelt expliciet of inhoud, budget en uitvoering bij hem/Online Matters passen",
        team,
      ),
    ).toBe(false);
    expect(
      isClientSafeLine("Intake en fitbesluit kort samenvatten", team),
    ).toBe(false);
  });

  it("blocks contact details, whoever they belong to", () => {
    expect(isClientSafeLine("Bellen met 06-50610409", team)).toBe(false);
    expect(isClientSafeLine("Mailen naar info@klant.nl", team)).toBe(false);
    expect(isClientSafeLine("Bellen met +31 6 50610409 morgen", team)).toBe(
      false,
    );
  });

  it("blocks a colleague by first name alone", () => {
    expect(isClientSafeLine("John zet de staging klaar", team)).toBe(false);
    expect(isClientSafeLine("Overleg met Rick over de planning", team)).toBe(
      false,
    );
  });

  it("blocks our own tooling and party names", () => {
    expect(isClientSafeLine("Kaart in Trello bijwerken", team)).toBe(false);
    expect(isClientSafeLine("Factuur in Moneybird klaarzetten", team)).toBe(
      false,
    );
    expect(isClientSafeLine("Marketingbende levert het aan", team)).toBe(false);
  });

  it("lets real work through", () => {
    expect(isClientSafeLine("Staging ingericht en gevuld", team)).toBe(true);
    expect(isClientSafeLine("Teksten en foto's geplaatst", team)).toBe(true);
    expect(
      isClientSafeLine("Levertijd tonen bij producten zonder voorraad", team),
    ).toBe(true);
    expect(isClientSafeLine("Zoekmachine-instellingen nagelopen", team)).toBe(
      true,
    );
  });

  it("does not mistake a client's own name for a colleague", () => {
    expect(isClientSafeLine("Mohammed levert de teksten aan", team)).toBe(true);
  });

  it("refuses an empty line", () => {
    expect(isClientSafeLine("", team)).toBe(false);
    expect(isClientSafeLine("   ", team)).toBe(false);
  });
});

describe("clientSafeLines", () => {
  it("keeps the safe work and strips markdown from it", () => {
    expect(
      clientSafeLines(
        [
          "**Staging** ingericht",
          "Rick belt de klant",
          "## Teksten geplaatst",
          "",
          "Formulieren getest",
        ],
        team,
      ),
    ).toEqual(["Staging ingericht", "Teksten geplaatst", "Formulieren getest"]);
  });
});

describe("describeWork", () => {
  it("never repeats an internal card title", () => {
    expect(
      describeWork({
        category: "overig",
        dealName: "Rick belt voor intake en B2B-fit",
        stage: "bezig",
        teamNames: team,
      }),
    ).toBe("de opdracht");
  });

  it("calls the work what the client recognises", () => {
    expect(
      describeWork({
        category: "seo",
        dealName: "SEO juli",
        stage: "maandelijks",
      }),
    ).toBe("het SEO-werk");
    expect(
      describeWork({
        category: "website-development",
        dealName: "Staging klaar",
        stage: "controle-livegang",
      }),
    ).toBe("uw website");
  });

  it("treats an unconfirmed assignment as a request, not as work", () => {
    expect(
      describeWork({
        category: "seo",
        dealName: "Voorstel ligt er",
        stage: "informatie-pipeline",
      }),
    ).toBe("uw aanvraag");
  });

  it("falls back to a safe card title when the category says nothing", () => {
    expect(
      describeWork({
        category: "onbekend",
        dealName: "Websitechat geplaatst",
        stage: "bezig",
        teamNames: team,
      }),
    ).toBe("Websitechat geplaatst");
  });
});
