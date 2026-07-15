import { describe, expect, it } from "vitest";
import { normalizeGmailMessage } from "./messageParser";

const encode = (value: string) =>
  btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("normalizeGmailMessage", () => {
  it("reads headers and prefers the plain MIME body", async () => {
    const message = await normalizeGmailMessage({
      id: "gmail-1",
      payload: {
        mimeType: "multipart/alternative",
        headers: [
          { name: "From", value: "Klant <klant@example.nl>" },
          {
            name: "To",
            value: '"Jansen, Jan" <jan@example.nl>, team@example.nl',
          },
          { name: "Subject", value: "Nieuwe opdracht" },
        ],
        parts: [
          { mimeType: "text/plain", body: { data: encode("Hallo CRM") } },
          { mimeType: "text/html", body: { data: encode("<b>Hallo</b>") } },
        ],
      },
    });

    expect(message).toEqual({
      from: "Klant <klant@example.nl>",
      to: ['"Jansen, Jan" <jan@example.nl>', "team@example.nl"],
      cc: [],
      subject: "Nieuwe opdracht",
      text: "Hallo CRM",
      html: "<b>Hallo</b>",
    });
  });

  it("loads large text parts by attachment id", async () => {
    const message = await normalizeGmailMessage(
      {
        id: "gmail-2",
        payload: {
          mimeType: "text/plain",
          body: { attachmentId: "body-attachment" },
        },
      },
      async (id) => (id === "body-attachment" ? encode("Grote mail") : ""),
    );

    expect(message.text).toBe("Grote mail");
  });
});
