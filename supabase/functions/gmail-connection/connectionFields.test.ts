import { describe, expect, it } from "vitest";

import { connectionFieldsAfterConsent } from "./connectionFields";

const base = {
  email: "john@marketingbende.nl",
  historyId: "999",
  refreshTokenEncrypted: "cipher",
  now: "2026-07-26T12:00:00.000Z",
};

const connected = {
  email: "john@marketingbende.nl",
  sync_label_id: "Label_7",
  sync_label_name: "CRM",
  sync_status: "connected",
  history_id: "42",
  last_synced_at: "2026-07-25T09:00:00.000Z",
};

describe("connectionFieldsAfterConsent", () => {
  it("imports nothing until a label is chosen on a first connection", () => {
    expect(
      connectionFieldsAfterConsent({ ...base, existing: null }),
    ).toMatchObject({
      email: "john@marketingbende.nl",
      history_id: "999",
      sync_label_id: null,
      sync_label_name: null,
      sync_status: "needs_label",
      last_synced_at: null,
    });
  });

  it("keeps the running import when the same mailbox re-consents", () => {
    // Adding the calendar scope must not silently switch the mail import off.
    expect(
      connectionFieldsAfterConsent({ ...base, existing: connected }),
    ).toMatchObject({
      refresh_token_encrypted: "cipher",
      history_id: "42",
      sync_label_id: "Label_7",
      sync_label_name: "CRM",
      sync_status: "connected",
      last_synced_at: "2026-07-25T09:00:00.000Z",
      last_error: null,
    });
  });

  it("compares addresses case-insensitively", () => {
    expect(
      connectionFieldsAfterConsent({
        ...base,
        email: "John@Marketingbende.NL",
        existing: connected,
      }),
    ).toMatchObject({
      email: "john@marketingbende.nl",
      sync_label_id: "Label_7",
    });
  });

  it("starts from scratch for a different mailbox", () => {
    expect(
      connectionFieldsAfterConsent({
        ...base,
        email: "rick@onlinematters.nl",
        existing: connected,
      }),
    ).toMatchObject({
      email: "rick@onlinematters.nl",
      history_id: "999",
      sync_label_id: null,
      sync_status: "needs_label",
      last_synced_at: null,
    });
  });

  it("still asks for a label when the old connection never had one", () => {
    expect(
      connectionFieldsAfterConsent({
        ...base,
        existing: { ...connected, sync_label_id: null, sync_label_name: null },
      }),
    ).toMatchObject({ sync_status: "needs_label", sync_label_id: null });
  });

  it("falls back to the fresh cursor when the old one is missing", () => {
    expect(
      connectionFieldsAfterConsent({
        ...base,
        existing: { ...connected, history_id: null },
      }),
    ).toMatchObject({ history_id: "999" });
  });
});
