import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { getUserSale } from "../_shared/getUserSale.ts";
import {
  findContactByCompanyName,
  getDocument,
  listDocuments,
} from "../_shared/moneybird/client.ts";
import {
  resolveCredentialsForAdministration,
  resolveMoneybirdCredentials,
  type MoneybirdCredentials,
} from "../_shared/moneybird/credentials.ts";
import {
  autoReconcileMatch,
  rankMoneybirdDocuments,
  type MoneybirdMatch,
} from "../_shared/moneybird/reconcile.ts";
import type {
  DocumentKind,
  MoneybirdDocument,
} from "../_shared/moneybird/types.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { createErrorResponse } from "../_shared/utils.ts";

type JsonObject = Record<string, unknown>;

type DealRow = {
  id: number;
  name: string;
  description: string | null;
  amount: number | null;
  company_id: number | null;
  assignee_ids: number[];
  moneybird_estimate_id: string | null;
  moneybird_estimate_administration_id: string | null;
  moneybird_estimate_live_state: string | null;
  moneybird_invoice_id: string | null;
  moneybird_invoice_administration_id: string | null;
  moneybird_invoice_live_state: string | null;
  companies: { id: number; name: string } | null;
};

const COLUMNS = {
  estimate: {
    id: "moneybird_estimate_id",
    status: "moneybird_estimate_status",
    administrationId: "moneybird_estimate_administration_id",
    liveState: "moneybird_estimate_live_state",
    checkedAt: "moneybird_estimate_checked_at",
    error: "moneybird_estimate_error",
  },
  invoice: {
    id: "moneybird_invoice_id",
    status: "moneybird_invoice_status",
    administrationId: "moneybird_invoice_administration_id",
    liveState: "moneybird_invoice_live_state",
    checkedAt: "moneybird_invoice_checked_at",
    error: "moneybird_invoice_error",
  },
} as const;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const requiredPositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const optionalText = (value: unknown, maxLength = 500): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const loadDeal = async (dealId: number, sale: JsonObject): Promise<DealRow> => {
  const { data, error } = await supabaseAdmin
    .from("deals")
    .select(
      "id, name, description, amount, company_id, assignee_ids, moneybird_estimate_id, moneybird_estimate_administration_id, moneybird_estimate_live_state, moneybird_invoice_id, moneybird_invoice_administration_id, moneybird_invoice_live_state, companies(id, name)",
    )
    .eq("id", dealId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("NOT_FOUND");
  const saleId = Number(sale.id);
  const assignees = Array.isArray(data.assignee_ids)
    ? data.assignee_ids.map(Number)
    : [];
  if (sale.administrator !== true && !assignees.includes(saleId)) {
    throw new Error("FORBIDDEN");
  }
  const company = Array.isArray(data.companies)
    ? data.companies[0] || null
    : data.companies || null;
  return { ...data, companies: company } as DealRow;
};

const safeDocument = (document: MoneybirdDocument) => ({
  id: document.id,
  state: document.state,
  reference: document.reference,
  amountExcludingTax: document.total_price_excl_tax,
  amountIncludingTax: document.total_price_incl_tax,
  description: (document.details || [])
    .flatMap((detail) => (detail.description ? [detail.description] : []))
    .join(" · ")
    .slice(0, 1_000),
  date: document.date || document.created_at || null,
  dueDate: document.due_date || null,
});

const storeDocument = async ({
  dealId,
  kind,
  document,
  administrationId,
}: {
  dealId: number;
  kind: DocumentKind;
  document: MoneybirdDocument;
  administrationId: string;
}) => {
  const columns = COLUMNS[kind];
  const checkedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("deals")
    .update({
      [columns.id]: document.id,
      [columns.status]: "completed",
      [columns.administrationId]: administrationId,
      [columns.liveState]: document.state || "onbekend",
      [columns.checkedAt]: checkedAt,
      [columns.error]: null,
    })
    .eq("id", dealId);
  if (error) throw error;
  return checkedAt;
};

const markCheckedWithoutMatch = async (dealId: number, kind: DocumentKind) => {
  const columns = COLUMNS[kind];
  const checkedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("deals")
    .update({ [columns.checkedAt]: checkedAt })
    .eq("id", dealId);
  if (error) throw error;
  return checkedAt;
};

const credentialsForStoredDocument = async (
  callerCredentials: MoneybirdCredentials,
  administrationId: string | null,
  encKey: string,
): Promise<MoneybirdCredentials | null> => {
  if (
    !administrationId ||
    administrationId === callerCredentials.administrationId
  ) {
    return callerCredentials;
  }
  return resolveCredentialsForAdministration(administrationId, encKey);
};

const loadCandidateDocuments = async (
  credentials: MoneybirdCredentials,
  kind: DocumentKind,
): Promise<MoneybirdDocument[]> => {
  const documents: MoneybirdDocument[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const batch = await listDocuments(credentials, kind, page, 100);
    documents.push(...batch);
    if (batch.length < 100) break;
  }
  return documents;
};

const candidateResponse = (match: MoneybirdMatch) => ({
  ...safeDocument(match.document),
  confidence: match.confidence,
  reasons: match.reasons,
});

const resolveDealContactId = async (
  deal: DealRow,
  credentials: MoneybirdCredentials,
): Promise<string | null> => {
  if (!deal.company_id || !deal.companies?.name) return null;
  const { data: cached, error } = await supabaseAdmin
    .from("moneybird_company_contacts")
    .select("contact_id")
    .eq("company_id", deal.company_id)
    .eq("administration_id", credentials.administrationId)
    .maybeSingle();
  if (error) throw error;
  if (cached?.contact_id) return cached.contact_id;
  return (
    (await findContactByCompanyName(credentials, deal.companies.name))?.id ||
    null
  );
};

const checkKind = async ({
  deal,
  kind,
  callerCredentials,
  encKey,
}: {
  deal: DealRow;
  kind: DocumentKind;
  callerCredentials: MoneybirdCredentials;
  encKey: string;
}) => {
  const columns = COLUMNS[kind];
  const storedId = deal[columns.id] as string | null;
  const storedAdministrationId = deal[columns.administrationId] as
    | string
    | null;
  if (storedId) {
    const storedCredentials = await credentialsForStoredDocument(
      callerCredentials,
      storedAdministrationId,
      encKey,
    );
    if (!storedCredentials) {
      return {
        linked: true,
        administrationId: storedAdministrationId || undefined,
        document: {
          id: storedId,
          state: deal[columns.liveState] || "onbekend",
        },
        checked: false,
        warning:
          "Het document is gekoppeld, maar de bijbehorende Moneybird-administratie is nu niet verbonden.",
        candidates: [],
      };
    }
    try {
      const document = await getDocument(storedCredentials, kind, storedId);
      const checkedAt = await storeDocument({
        dealId: deal.id,
        kind,
        document,
        administrationId: storedCredentials.administrationId,
      });
      return {
        linked: true,
        administrationId: storedCredentials.administrationId,
        document: safeDocument(document),
        checked: true,
        checkedAt,
        candidates: [],
      };
    } catch {
      return {
        linked: true,
        administrationId: storedAdministrationId || undefined,
        document: {
          id: storedId,
          state: deal[columns.liveState] || "onbekend",
        },
        checked: false,
        warning:
          "Het gekoppelde document kon niet live bij Moneybird worden gecontroleerd.",
        candidates: [],
      };
    }
  }

  const documents = await loadCandidateDocuments(callerCredentials, kind);
  const reference =
    kind === "estimate" ? `CRM-DEAL-${deal.id}` : `CRM-INV-${deal.id}`;
  const referenceMatch = documents.find(
    (document) => document.reference === reference,
  );
  if (referenceMatch) {
    const checkedAt = await storeDocument({
      dealId: deal.id,
      kind,
      document: referenceMatch,
      administrationId: callerCredentials.administrationId,
    });
    return {
      linked: true,
      administrationId: callerCredentials.administrationId,
      document: safeDocument(referenceMatch),
      checked: true,
      checkedAt,
      reconciled: true,
      candidates: [],
    };
  }

  if (!deal.companies?.name) {
    const checkedAt = await markCheckedWithoutMatch(deal.id, kind);
    return {
      linked: false,
      checked: true,
      checkedAt,
      warning:
        "De opdracht heeft geen bedrijfsnaam voor de Moneybird-zoekactie.",
      candidates: [],
    };
  }
  const contactId = await resolveDealContactId(deal, callerCredentials);
  if (!contactId) {
    const checkedAt = await markCheckedWithoutMatch(deal.id, kind);
    return { linked: false, checked: true, checkedAt, candidates: [] };
  }

  const matches = rankMoneybirdDocuments({
    kind,
    dealId: deal.id,
    dealName: deal.name,
    dealDescription: deal.description,
    amount: deal.amount,
    contactId,
    documents,
  });
  const adopted = autoReconcileMatch(matches);
  if (adopted) {
    const checkedAt = await storeDocument({
      dealId: deal.id,
      kind,
      document: adopted.document,
      administrationId: callerCredentials.administrationId,
    });
    return {
      linked: true,
      document: safeDocument(adopted.document),
      checked: true,
      checkedAt,
      reconciled: true,
      candidates: [],
    };
  }

  const checkedAt = await markCheckedWithoutMatch(deal.id, kind);
  return {
    linked: false,
    checked: true,
    checkedAt,
    candidates: matches.slice(0, 5).map(candidateResponse),
  };
};

const linkCandidate = async ({
  deal,
  kind,
  documentId,
  credentials,
}: {
  deal: DealRow;
  kind: DocumentKind;
  documentId: string;
  credentials: MoneybirdCredentials;
}) => {
  if (!deal.companies?.name) throw new Error("NO_COMPANY");
  const [contactId, document] = await Promise.all([
    resolveDealContactId(deal, credentials),
    getDocument(credentials, kind, documentId),
  ]);
  if (!contactId || document.contact_id !== contactId) {
    throw new Error("DOCUMENT_CONTACT_MISMATCH");
  }
  const checkedAt = await storeDocument({
    dealId: deal.id,
    kind,
    document,
    administrationId: credentials.administrationId,
  });
  return {
    linked: true,
    administrationId: credentials.administrationId,
    document: safeDocument(document),
    checked: true,
    checkedAt,
    reconciled: true,
    candidates: [],
  };
};

const handleRequest = async (
  req: Request,
  user: NonNullable<Parameters<typeof getUserSale>[0]>,
): Promise<Response> => {
  if (req.method !== "POST") {
    return createErrorResponse(405, "Method Not Allowed");
  }
  let body: JsonObject;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return createErrorResponse(400, "Ongeldige aanvraag.");
    }
    body = parsed as JsonObject;
  } catch {
    return createErrorResponse(400, "Ongeldige aanvraag.");
  }

  const dealId = requiredPositiveInteger(body.dealId);
  if (!dealId) return createErrorResponse(400, "Opdracht is verplicht.");
  const sale = await getUserSale(user);
  if (!sale || sale.disabled === true) {
    return createErrorResponse(401, "Unauthorized");
  }
  const encKey = Deno.env.get("MONEYBIRD_ENC_KEY");
  if (!encKey) {
    return createErrorResponse(
      500,
      "De Moneybird-koppeling is niet goed geconfigureerd op de server.",
    );
  }

  try {
    const [deal, credentials] = await Promise.all([
      loadDeal(dealId, sale as JsonObject),
      resolveMoneybirdCredentials(Number(sale.id), encKey),
    ]);
    if (!credentials) {
      return createErrorResponse(
        412,
        "Koppel eerst uw Moneybird-administratie via uw profielpagina.",
      );
    }
    const action = optionalText(body.action, 40) || "check";
    if (action === "link_candidate") {
      const kind =
        body.kind === "estimate"
          ? "estimate"
          : body.kind === "invoice"
            ? "invoice"
            : null;
      const documentId = optionalText(body.documentId, 80);
      if (!kind || !documentId) {
        return createErrorResponse(
          400,
          "Document en documenttype zijn verplicht.",
        );
      }
      return jsonResponse({
        data: {
          [kind]: await linkCandidate({
            deal,
            kind,
            documentId,
            credentials,
          }),
        },
      });
    }
    if (action !== "check") {
      return createErrorResponse(400, "Onbekende Moneybird-actie.");
    }

    const [estimate, invoice] = await Promise.all([
      checkKind({
        deal,
        kind: "estimate",
        callerCredentials: credentials,
        encKey,
      }),
      checkKind({
        deal,
        kind: "invoice",
        callerCredentials: credentials,
        encKey,
      }),
    ]);
    return jsonResponse({ data: { estimate, invoice } });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return createErrorResponse(404, "Opdracht niet gevonden.");
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return createErrorResponse(403, "Geen toegang tot deze opdracht.");
    }
    if (
      error instanceof Error &&
      error.message === "DOCUMENT_CONTACT_MISMATCH"
    ) {
      return createErrorResponse(
        409,
        "Dit Moneybird-document hoort niet bij het bedrijf van deze opdracht.",
      );
    }
    console.error(
      `moneybird_status failed for deal ${dealId}:`,
      error instanceof Error ? error.name : "UnknownError",
    );
    return createErrorResponse(
      502,
      "Moneybird kon nu niet worden gecontroleerd. Probeer het later opnieuw.",
    );
  }
};

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) =>
        user
          ? handleRequest(req, user)
          : createErrorResponse(401, "Unauthorized"),
      ),
    ),
  ),
);
