import { describe, expect, it } from "vitest";
import { extractTrelloNextSteps } from "./extractTrelloNextSteps";

describe("extractTrelloNextSteps", () => {
  it("turns top-level bullets under Volgende stappen into stable tasks", () => {
    expect(
      extractTrelloNextSteps({
        description: `
### Context
Dit blijft vrije tekst.

### Volgende stappen
- [ ] Plan met John bespreken op 21-07-2026
- **Klant terugbellen**
  - Interne toelichting, geen losse taak

### Bevindingen
- Geen taak
`,
      }),
    ).toEqual([
      {
        id: "derived:description:0",
        name: "Plan met John bespreken op 21-07-2026",
        complete: false,
        memberId: null,
        due: "2026-07-21",
      },
      {
        id: "derived:description:1",
        name: "Klant terugbellen",
        complete: false,
        memberId: null,
        due: null,
      },
    ]);
  });

  it("extracts explicit inline actions from comments and preserves completion", () => {
    const steps = extractTrelloNextSteps({
      description: "Geen acties",
      comments: [
        {
          id: "a1",
          date: "2026-07-17T09:00:00Z",
          authorName: "Rick",
          text: "Actie: offerte versturen op 2026-07-22",
        },
        {
          id: "a2",
          date: "2026-07-17T10:00:00Z",
          authorName: "John",
          text: "Volgende stappen:\n- [x] Toegang ontvangen\n- Pagina bouwen",
        },
      ],
    });
    expect(steps).toEqual([
      expect.objectContaining({
        id: "derived:comment:a1:0",
        name: "offerte versturen op 2026-07-22",
        due: "2026-07-22",
      }),
      expect.objectContaining({
        id: "derived:comment:a2:0",
        name: "Toegang ontvangen",
        complete: true,
      }),
      expect.objectContaining({
        id: "derived:comment:a2:1",
        name: "Pagina bouwen",
        complete: false,
      }),
    ]);
  });

  it("deduplicates an identical step repeated in a later comment", () => {
    const steps = extractTrelloNextSteps({
      description: "Volgende stap: Klant bellen",
      comments: [
        {
          id: "a1",
          date: "2026-07-17T09:00:00Z",
          authorName: "Rick",
          text: "Actie: klant bellen",
        },
      ],
    });
    expect(steps).toHaveLength(1);
  });

  it("does not invent tasks from ordinary prose", () => {
    expect(
      extractTrelloNextSteps({
        description: "De klant wil mogelijk volgende week bellen.",
        comments: [
          {
            id: "a1",
            date: "2026-07-17T09:00:00Z",
            authorName: "Rick",
            text: "Dit project heeft veel context maar geen expliciete actie.",
          },
        ],
      }),
    ).toEqual([]);
  });
});
