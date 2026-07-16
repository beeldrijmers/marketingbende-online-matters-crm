import { describe, expect, it } from "vitest";

import { getExternalActivityAttribution } from "./activityAttribution";

describe("getExternalActivityAttribution", () => {
  it("keeps the Trello author separate from the technical CRM owner", () => {
    expect(
      getExternalActivityAttribution({
        source: "trello",
        sourceAuthor: " Rick Maarssen ",
      }),
    ).toEqual({ source: "trello", sourceAuthor: "Rick Maarssen" });
  });

  it("uses the Trello source even when the author is unavailable", () => {
    expect(
      getExternalActivityAttribution({ source: "trello", sourceAuthor: " " }),
    ).toEqual({ source: "trello", sourceAuthor: null });
  });

  it("leaves manual CRM actions attached to their CRM actor", () => {
    expect(
      getExternalActivityAttribution({
        source: "manual",
        sourceAuthor: "Rick Maarssen",
      }),
    ).toBeNull();
  });
});
