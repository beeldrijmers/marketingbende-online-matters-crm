import { parseActivityNote } from "./activityNote";

describe("parseActivityNote", () => {
  it("separates a Trello author from the markdown comment", () => {
    expect(
      parseActivityNote(
        "[Trello - Rick Maarssen]\nGebruik **Shared Inbox** voor het team.",
      ),
    ).toEqual({
      body: "Gebruik **Shared Inbox** voor het team.",
      isAttachment: false,
      source: "trello",
      sourceAuthor: "Rick Maarssen",
    });
  });

  it("hides the internal marker on imported Trello attachments", () => {
    expect(
      parseActivityNote(
        "[Trello - bijlage] ontwerp.png\n\n[trello-bijlage:abc123]",
      ),
    ).toEqual({
      body: "ontwerp.png",
      isAttachment: true,
      source: "trello",
      sourceAuthor: null,
    });
  });

  it("keeps regular CRM note content unchanged", () => {
    expect(parseActivityNote("Eerste regel\n\n- punt één")).toEqual({
      body: "Eerste regel\n\n- punt één",
      isAttachment: false,
      source: null,
      sourceAuthor: null,
    });
  });
});
