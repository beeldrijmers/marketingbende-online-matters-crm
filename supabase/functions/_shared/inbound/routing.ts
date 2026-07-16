/**
 * Explicit BCC/forwarding is an intentional CRM action. A connected Gmail
 * mailbox is not: it may contain suppliers, newsletters and private traffic.
 * Keep that distinction central so future providers cannot accidentally opt
 * into auto-creating CRM records.
 */
export type InboundMailSource = "explicit" | "gmail";

export const allowsAutomaticEntityCreation = (
  source: InboundMailSource,
): boolean => source === "explicit";
