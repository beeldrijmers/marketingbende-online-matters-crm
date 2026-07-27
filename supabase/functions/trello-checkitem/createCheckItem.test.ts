import { describe, expect, it, vi } from "vitest";

import {
  createCheckItem,
  DEFAULT_CHECKLIST_NAME,
  pickChecklist,
} from "./createCheckItem";

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(""),
  json: () => Promise.resolve(body),
});

describe("pickChecklist", () => {
  it("kiest de lijst die er al is", () => {
    expect(pickChecklist([{ id: "a", name: "Werk" }])).toEqual({
      id: "a",
      name: "Werk",
    });
  });

  it("kiest bij meerdere lijsten die van ons, niet de eerste willekeurige", () => {
    expect(
      pickChecklist([
        { id: "a", name: "Inkoop" },
        { id: "b", name: DEFAULT_CHECKLIST_NAME },
      ])?.id,
    ).toBe("b");
  });

  it("geeft null als de kaart geen lijst heeft", () => {
    expect(pickChecklist([])).toBeNull();
  });
});

describe("createCheckItem", () => {
  it("zet de stap in de bestaande lijst", async () => {
    const calls: { url: string; method?: string }[] = [];
    const fetchImpl = vi.fn((url: string, init?: { method?: string }) => {
      calls.push({ url, method: init?.method });
      if (url.includes("/checklists") && init?.method === "GET") {
        return Promise.resolve(ok([{ id: "lijst-1", name: "Stappen" }]));
      }
      return Promise.resolve(ok({ id: "item-9" }));
    });

    const id = await createCheckItem({
      cardId: "kaart-1",
      name: "Akkoord ophalen",
      apiKey: "k",
      token: "t",
      fetchImpl: fetchImpl as never,
    });

    expect(id).toBe("item-9");
    // Geen tweede lijst aangemaakt naast een bestaande.
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.url).toContain("/checklists/lijst-1/checkItems");
    expect(post.url).toContain("name=Akkoord+ophalen");
    // Geen due meesturen: dat is een betaalde Trello-functie en de API negeert
    // hem stil, dus meesturen zou suggereren dat de datum op de kaart landt.
    expect(post.url).not.toContain("due=");
  });

  it("maakt een lijst als de kaart er geen heeft", async () => {
    const posts: string[] = [];
    const fetchImpl = vi.fn((url: string, init?: { method?: string }) => {
      if (init?.method === "POST") posts.push(url);
      if (url.includes("/checklists") && init?.method === "GET") {
        return Promise.resolve(ok([]));
      }
      if (url.includes("/cards/") && init?.method === "POST") {
        return Promise.resolve(ok({ id: "nieuwe-lijst" }));
      }
      return Promise.resolve(ok({ id: "item-1" }));
    });

    await createCheckItem({
      cardId: "kaart-2",
      name: "Bellen",
      apiKey: "k",
      token: "t",
      fetchImpl: fetchImpl as never,
    });

    expect(posts[0]).toContain(`name=${DEFAULT_CHECKLIST_NAME}`);
    expect(posts[1]).toContain("/checklists/nieuwe-lijst/checkItems");
  });

  it("laat een fout van Trello niet als succes doorgaan", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve("invalid token"),
        json: () => Promise.resolve(null),
      }),
    );

    await expect(
      createCheckItem({
        cardId: "kaart-3",
        name: "Bellen",
        apiKey: "k",
        token: "t",
        fetchImpl: fetchImpl as never,
      }),
    ).rejects.toThrow(/401/);
  });

  it("gooit als Trello geen id teruggeeft", async () => {
    const fetchImpl = vi.fn((url: string, init?: { method?: string }) =>
      Promise.resolve(
        url.includes("/checklists") && init?.method === "GET"
          ? ok([{ id: "lijst-1" }])
          : ok({}),
      ),
    );

    await expect(
      createCheckItem({
        cardId: "kaart-4",
        name: "Bellen",
        apiKey: "k",
        token: "t",
        fetchImpl: fetchImpl as never,
      }),
    ).rejects.toThrow(/checkItem id/);
  });
});
