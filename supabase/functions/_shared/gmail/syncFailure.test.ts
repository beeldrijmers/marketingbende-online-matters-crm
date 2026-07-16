import { describe, expect, it } from "vitest";

import { GoogleApiError } from "./client.ts";
import {
  addGmailMessageFailure,
  classifyGmailMessageFailure,
  isUnavailableGmailMessage,
} from "./syncFailure.ts";

describe("Gmail sync failure diagnostics", () => {
  it("uses stable categories without retaining provider error details", () => {
    expect(
      classifyGmailMessageFailure(new GoogleApiError(404, "mailbox detail")),
    ).toBe("gmail_api_not_found");
    expect(
      classifyGmailMessageFailure(new GoogleApiError(503, "mailbox detail")),
    ).toBe("gmail_api_transient");
    expect(
      classifyGmailMessageFailure(new Error("Inbound processing returned 502")),
    ).toBe("inbound_server_error");
    expect(classifyGmailMessageFailure(new Error("unexpected detail"))).toBe(
      "processing_error",
    );
  });

  it("aggregates repeated failures by category", () => {
    const failures = {};

    addGmailMessageFailure(failures, new GoogleApiError(404, "one"));
    addGmailMessageFailure(failures, new GoogleApiError(404, "two"));
    addGmailMessageFailure(
      failures,
      new Error("Inbound processing returned 500"),
    );

    expect(failures).toEqual({
      gmail_api_not_found: 2,
      inbound_server_error: 1,
    });
  });

  it("recognizes only a missing Gmail resource as safely unavailable", () => {
    expect(isUnavailableGmailMessage(new GoogleApiError(404, "gone"))).toBe(
      true,
    );
    expect(isUnavailableGmailMessage(new GoogleApiError(503, "retry"))).toBe(
      false,
    );
  });
});
