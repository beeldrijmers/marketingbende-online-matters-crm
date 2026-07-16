import { describe, expect, it } from "vitest";

import { allowsAutomaticEntityCreation } from "./routing.ts";

describe("inbound mail routing", () => {
  it("keeps intentional BCC and forwarding capable of creating CRM entities", () => {
    expect(allowsAutomaticEntityCreation("explicit")).toBe(true);
  });

  it("never lets a connected Gmail mailbox auto-create CRM entities", () => {
    expect(allowsAutomaticEntityCreation("gmail")).toBe(false);
  });
});
