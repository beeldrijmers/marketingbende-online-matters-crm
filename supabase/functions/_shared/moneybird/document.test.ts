// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
// Import WITHOUT the .ts extension — required for the Vitest "functions"
// project (the Deno source imports use .ts).
import { createDocumentForDeal } from "./document";
import { connectionAad, encryptToken } from "./tokenCrypto";

const mockFrom = vi.hoisted(() => vi.fn());
vi.mock("../supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const mockCreateDocument = vi.hoisted(() => vi.fn());
const mockFindDocumentByReference = vi.hoisted(() => vi.fn());
const mockCreateContact = vi.hoisted(() => vi.fn());
const mockFindContactByCompanyName = vi.hoisted(() => vi.fn());
vi.mock("./client.ts", () => ({
  createDocument: (...args: unknown[]) => mockCreateDocument(...args),
  findDocumentByReference: (...args: unknown[]) =>
    mockFindDocumentByReference(...args),
  createContact: (...args: unknown[]) => mockCreateContact(...args),
  findContactByCompanyName: (...args: unknown[]) =>
    mockFindContactByCompanyName(...args),
}));

const KEY = btoa(
  String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i)),
);

// A minimal thenable query builder: every method chains, awaiting it (or
// calling maybeSingle) resolves to the given result. `updates` collects the
// payloads passed to .update() so tests can assert what was written.
const makeBuilder = (
  result: { data?: unknown; error: unknown },
  updates?: unknown[],
) => {
  const builder: any = {};
  for (const method of [
    "update",
    "select",
    "insert",
    "eq",
    "or",
    "lt",
    "is",
    "limit",
    "contains",
  ]) {
    builder[method] = (...args: unknown[]) => {
      if (method === "update" && updates) updates.push(args[0]);
      return builder;
    };
  }
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return builder;
};

// Routes supabaseAdmin.from(table) calls to a per-table queue of builders.
const routeTables = (
  queues: Record<string, ReturnType<typeof makeBuilder>[]>,
) => {
  const counters: Record<string, number> = {};
  mockFrom.mockImplementation((table: string) => {
    const queue = queues[table];
    if (!queue) throw new Error(`unexpected table ${table}`);
    const index = counters[table] ?? 0;
    counters[table] = index + 1;
    const builder = queue[Math.min(index, queue.length - 1)];
    if (!builder) throw new Error(`no builder left for table ${table}`);
    return builder;
  });
};

const CALLER = { apiToken: "token-Y", administrationId: "ADMIN_Y" };

// The pre-claim read: authorization (assignee membership) + the previous
// attempt's administration hint.
const preReadDeal = (previousAdministrationId: string | null) => ({
  data: {
    id: 7,
    moneybird_invoice_administration_id: previousAdministrationId,
  },
  error: null,
});

const claimedDeal = () => ({
  data: {
    id: 7,
    company_id: 3,
    name: "Deal",
    amount: 1000,
    description: null,
  },
  error: null,
});

describe("createDocumentForDeal cross-administration reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adopts a document that a failed attempt left in ANOTHER administration", async () => {
    const dealUpdates: unknown[] = [];
    const encrypted = await encryptToken("token-X", KEY, connectionAad(8));
    routeTables({
      deals: [
        makeBuilder(preReadDeal("ADMIN_X")), // authorization + hint read
        makeBuilder({ error: null }, dealUpdates), // stale demotion
        makeBuilder(claimedDeal(), dealUpdates), // atomic claim
        makeBuilder({ error: null }, dealUpdates), // markDocumentCompleted
      ],
      moneybird_connections: [
        makeBuilder({
          data: { sales_id: 8, api_token_encrypted: encrypted },
          error: null,
        }),
      ],
    });
    mockFindDocumentByReference.mockResolvedValue({
      id: "DOC_IN_X",
      reference: "CRM-INV-7",
    });

    const outcome = await createDocumentForDeal({
      documentKind: "invoice",
      dealId: 7,
      taxRateId: "rate1",
      description: "d",
      currency: "EUR",
      salesId: 42,
      credentials: CALLER,
      encKey: KEY,
    });

    expect(outcome).toEqual({
      kind: "created",
      documentId: "DOC_IN_X",
      alreadyExisted: true,
    });
    // The reconciliation ran with the PREVIOUS administration's credentials,
    // and STRICT: a listing failure there must abort instead of duplicating.
    expect(mockFindDocumentByReference).toHaveBeenCalledWith(
      { apiToken: "token-X", administrationId: "ADMIN_X" },
      "invoice",
      "CRM-INV-7",
      { strict: true },
    );
    // No new real document was created anywhere.
    expect(mockCreateDocument).not.toHaveBeenCalled();
    // The deal records the document under the administration it lives in.
    expect(dealUpdates.at(-1)).toMatchObject({
      moneybird_invoice_id: "DOC_IN_X",
      moneybird_invoice_status: "completed",
      moneybird_invoice_administration_id: "ADMIN_X",
    });
  });

  it("creates in its own administration when the previous one has no document", async () => {
    const dealUpdates: unknown[] = [];
    const encrypted = await encryptToken("token-X", KEY, connectionAad(8));
    routeTables({
      deals: [
        makeBuilder(preReadDeal("ADMIN_X")), // authorization + hint read
        makeBuilder({ error: null }, dealUpdates), // stale demotion
        makeBuilder(claimedDeal(), dealUpdates), // atomic claim
        makeBuilder({ error: null }, dealUpdates), // markDocumentCompleted
      ],
      moneybird_connections: [
        makeBuilder({
          data: { sales_id: 8, api_token_encrypted: encrypted },
          error: null,
        }),
      ],
      companies: [
        makeBuilder({
          data: { id: 3, name: "Acme" },
          error: null,
        }),
      ],
      moneybird_company_contacts: [
        makeBuilder({ data: { contact_id: "C1" }, error: null }),
      ],
    });
    // Nothing to adopt in ADMIN_X, nothing to reconcile in ADMIN_Y.
    mockFindDocumentByReference.mockResolvedValue(null);
    mockCreateDocument.mockResolvedValue({ id: "DOC_NEW_Y" });

    const outcome = await createDocumentForDeal({
      documentKind: "invoice",
      dealId: 7,
      taxRateId: "rate1",
      description: "d",
      currency: "EUR",
      salesId: 42,
      credentials: CALLER,
      encKey: KEY,
    });

    expect(outcome).toEqual({
      kind: "created",
      documentId: "DOC_NEW_Y",
      alreadyExisted: false,
    });
    expect(mockCreateDocument).toHaveBeenCalledWith(
      CALLER,
      "invoice",
      expect.anything(),
    );
    expect(dealUpdates.at(-1)).toMatchObject({
      moneybird_invoice_id: "DOC_NEW_Y",
      moneybird_invoice_administration_id: "ADMIN_Y",
    });
  });

  it("records the attempted administration when the create fails", async () => {
    const dealUpdates: unknown[] = [];
    routeTables({
      deals: [
        makeBuilder(preReadDeal(null)), // first attempt: no previous administration
        makeBuilder({ error: null }, dealUpdates), // stale demotion
        makeBuilder(claimedDeal(), dealUpdates), // atomic claim
        makeBuilder({ error: null }, dealUpdates), // markDocumentFailed
      ],
      companies: [makeBuilder({ data: { id: 3, name: "Acme" }, error: null })],
      moneybird_company_contacts: [
        makeBuilder({ data: { contact_id: "C1" }, error: null }),
      ],
    });
    mockFindDocumentByReference.mockResolvedValue(null);
    mockCreateDocument.mockRejectedValue(new Error("Moneybird down"));

    await expect(
      createDocumentForDeal({
        documentKind: "invoice",
        dealId: 7,
        taxRateId: "rate1",
        description: "d",
        currency: "EUR",
        salesId: 42,
        credentials: CALLER,
        encKey: KEY,
      }),
    ).rejects.toThrow("Moneybird down");

    // The failure records WHICH administration was attempted, so a later
    // retry from another administration can reconcile against it.
    expect(dealUpdates.at(-1)).toMatchObject({
      moneybird_invoice_status: "failed",
      moneybird_invoice_administration_id: "ADMIN_Y",
    });
  });

  it("returns not_found for a caller who is not an assignee of the deal", async () => {
    // The authorization pre-read matches no row for a non-assignee (same
    // behaviour as RLS would give a direct query), so nothing is claimed and
    // nothing reaches Moneybird.
    routeTables({
      deals: [makeBuilder({ data: null, error: null })],
    });

    const outcome = await createDocumentForDeal({
      documentKind: "invoice",
      dealId: 7,
      taxRateId: "rate1",
      description: "d",
      currency: "EUR",
      salesId: 42,
      credentials: CALLER,
      encKey: KEY,
    });

    expect(outcome).toEqual({ kind: "not_found" });
    expect(mockFindDocumentByReference).not.toHaveBeenCalled();
    expect(mockCreateDocument).not.toHaveBeenCalled();
  });

  it("aborts a retry when the previous administration cannot be checked, preserving the hint", async () => {
    const dealUpdates: unknown[] = [];
    const encrypted = await encryptToken("token-X", KEY, connectionAad(8));
    routeTables({
      deals: [
        makeBuilder(preReadDeal("ADMIN_X")), // authorization + hint read
        makeBuilder({ error: null }, dealUpdates), // stale demotion
        makeBuilder(claimedDeal(), dealUpdates), // atomic claim
        makeBuilder({ error: null }, dealUpdates), // markDocumentFailed
      ],
      moneybird_connections: [
        makeBuilder({
          data: { sales_id: 8, api_token_encrypted: encrypted },
          error: null,
        }),
      ],
    });
    // The strict reconciliation against ADMIN_X fails (Moneybird hiccup): a
    // document may exist there, so the attempt must abort...
    mockFindDocumentByReference.mockRejectedValue(
      new Error("Could not verify whether an earlier invoice already exists"),
    );

    await expect(
      createDocumentForDeal({
        documentKind: "invoice",
        dealId: 7,
        taxRateId: "rate1",
        description: "d",
        currency: "EUR",
        salesId: 42,
        credentials: CALLER,
        encKey: KEY,
      }),
    ).rejects.toThrow("Could not verify");

    // ...without creating anything...
    expect(mockCreateDocument).not.toHaveBeenCalled();
    // ...and the failure keeps pointing at ADMIN_X (where the document may
    // live) instead of adopting the current caller's ADMIN_Y.
    expect(dealUpdates.at(-1)).toMatchObject({
      moneybird_invoice_status: "failed",
      moneybird_invoice_administration_id: "ADMIN_X",
    });
  });
});
