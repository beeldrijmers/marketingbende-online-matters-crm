import type { Identifier, RaRecord } from "ra-core";
import type { ComponentType } from "react";

import type {
  COMPANY_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
} from "./consts";

export type SignUpData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

/**
 * The three collaborating parties. Stored on `sales.partij`; the single source
 * of truth for the union, imported by sales/party.ts (labels/colors) and the
 * ownership UI.
 */
export type PartyKey = "online_matters" | "marketingbende" | "groeien_met_ads";

/** The source that created an activity-bearing CRM record. */
export type ActivitySource = "manual" | "trello";

export type SalesFormData = {
  avatar?: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  administrator: boolean;
  disabled: boolean;
  partij?: PartyKey;
  hourly_rate?: number | null;
};

export type Sale = {
  first_name: string;
  last_name: string;
  administrator: boolean;
  avatar?: RAFile;
  disabled?: boolean;
  user_id: string;
  partij?: PartyKey;
  hourly_rate?: number | null;

  /**
   * This is a copy of the user's email, to make it easier to handle by react admin
   * DO NOT UPDATE this field directly, it should be updated by the backend
   */
  email: string;

  /**
   * This is used by the fake rest provider to store the password
   * DO NOT USE this field in your code besides the fake rest provider
   * @deprecated
   */
  password?: string;
} & Pick<RaRecord, "id">;

export type Company = {
  name: string;
  logo: RAFile;
  sector: string;
  size: 1 | 10 | 50 | 250 | 500;
  linkedin_url: string;
  website: string;
  phone_number: string;
  address: string;
  zipcode: string;
  city: string;
  state_abbr: string;
  sales_id?: Identifier;
  activity_source?: ActivitySource;
  activity_source_author?: string | null;
  created_at: string;
  description: string;
  revenue: string;
  tax_identifier: string;
  country: string;
  context_links?: string[];
  nb_contacts?: number;
  nb_deals?: number;
} & Pick<RaRecord, "id">;

export type EmailAndType = {
  email: string;
  type: "Work" | "Home" | "Other";
};

export type PhoneNumberAndType = {
  number: string;
  type: "Work" | "Home" | "Other";
};

export type Contact = {
  first_name: string;
  last_name: string;
  title: string;
  company_id?: Identifier | null;
  email_jsonb: EmailAndType[];
  avatar?: Partial<RAFile>;
  linkedin_url?: string | null;
  first_seen: string;
  last_seen: string;
  has_newsletter: boolean;
  tags: number[];
  gender: string;
  sales_id?: Identifier;
  activity_source?: ActivitySource;
  activity_source_author?: string | null;
  status: string;
  background: string;
  phone_jsonb: PhoneNumberAndType[];
  nb_tasks?: number;
  company_name?: string;
} & Pick<RaRecord, "id">;

export type ContactNote = {
  contact_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  activity_source?: ActivitySource;
  activity_source_author?: string | null;
  source_event_id?: string | null;
  status: string;
  attachments?: AttachmentNote[];
} & Pick<RaRecord, "id">;

export type Deal = {
  name: string;
  company_id: Identifier;
  contact_ids: Identifier[];
  category: string | null;
  stage: string;
  description: string | null;
  amount: number | null;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  expected_closing_date: string | null;
  start_date?: string | null;
  delivery_date?: string | null;
  trello_card_id?: string | null;
  activity_source?: ActivitySource;
  activity_source_author?: string | null;
  sales_id: Identifier;
  // The sales users this deal is assigned to; a deal is only visible to its
  // assignees (enforced by RLS). Defaults to the owner.
  assignee_ids?: Identifier[];
  index: number;
  // "On hold" marking - a parked deal stays in its stage and shows a badge.
  on_hold?: boolean;
  // Internal work (Happr, own projects) vs external client work; drives the
  // Intern/Extern board filter.
  is_internal?: boolean;
  won_notified_at?: string | null;
  revenue_period?: "maandelijks" | "eenmalig" | null;
  moneybird_estimate_id?: string;
  moneybird_estimate_status?: "pending" | "completed" | "failed";
  moneybird_estimate_claimed_at?: string;
  moneybird_estimate_created_by?: Identifier;
  moneybird_estimate_error?: string;
  moneybird_estimate_administration_id?: string;
  moneybird_estimate_live_state?: string | null;
  moneybird_estimate_checked_at?: string | null;
  moneybird_invoice_id?: string;
  moneybird_invoice_status?: "pending" | "completed" | "failed";
  moneybird_invoice_claimed_at?: string;
  moneybird_invoice_created_by?: Identifier;
  moneybird_invoice_error?: string;
  moneybird_invoice_administration_id?: string;
  moneybird_invoice_live_state?: string | null;
  moneybird_invoice_checked_at?: string | null;
  // Read-only, batched enrichment used by the Kanban to show which Inzyte
  // sources are already assigned without opening every card.
  inzyte_link?: InzyteLink | null;
  latest_seo_report?: SeoMonthlyReportSummary | null;
} & Pick<RaRecord, "id">;

export type IntegrationRun = {
  integration: "trello" | "gmail";
  run_kind: "manual" | "backfill" | "scheduled";
  status: "running" | "success" | "partial" | "failed";
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  items_processed: number;
  failed_count: number;
  summary: {
    cardCount?: number;
    synced?: number;
    ignored?: number;
    stageCounts?: {
      "informatie-pipeline": number;
      "bevestigd-inplannen": number;
      "on-hold": number;
      bezig: number;
      "controle-livegang": number;
      "facturatie-live": number;
      won: number;
      maandelijks: number;
    };
    mode?: "boundary_reset" | "incremental";
    found?: number;
    processed?: number;
    skipped?: number;
    failed?: number;
  };
  error: string | null;
} & Pick<RaRecord, "id">;

export type InzyteIntegration = {
  id: string;
  userId: string;
  provider: string;
  active: boolean;
  expiresAt: string | null;
  updatedAt: string | null;
  profile: {
    name: string | null;
    email: string | null;
    picture: string | null;
  };
  settings: {
    needsReauth: boolean;
    reauthReason: string | null;
    propertyId: string | null;
    propertyName: string | null;
    siteUrl: string | null;
    accountId: string | null;
    locationId: string | null;
    locationName: string | null;
    customerId: string | null;
    accountName: string | null;
    loginCustomerId: string | null;
  };
};

export type InzyteWorkspace = {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  integrations: InzyteIntegration[];
};

export type InzyteLink = {
  id: number;
  deal_id: number;
  company_id: number | null;
  website_url: string | null;
  inzyte_user_id: string;
  ga4_connection_id: string | null;
  ga4_connection_name: string | null;
  ga4_property_id: string | null;
  ga4_property_name: string | null;
  gsc_site_url: string | null;
  gbp_account_id: string | null;
  gbp_location_id: string | null;
  gbp_location_name: string | null;
  ads_customer_id: string | null;
  ads_account_name: string | null;
  ads_login_customer_id: string | null;
  last_verified_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type InzyteRun = {
  id: number;
  deal_id: number;
  inzyte_link_id: number | null;
  action: string;
  status: "running" | "success" | "failed";
  date_start: string | null;
  date_end: string | null;
  started_at: string;
  finished_at: string | null;
  result: unknown;
  summary: Record<string, unknown>;
  error: string | null;
};

export type InzyteBootstrap = {
  deal: {
    id: number;
    name: string;
    companyId: number | null;
    companyName: string | null;
    companyWebsite: string | null;
  };
  link: InzyteLink | null;
  suggestedLink: InzyteLink | null;
  workspaces: InzyteWorkspace[];
  recentRuns: InzyteRun[];
  monthlyReports: SeoMonthlyReport[];
};

export type SeoMonthlyHeadlineMetric = {
  key: string;
  label: string;
  source: "GA4" | "Search Console";
  group: "seo" | "website_context";
  definition: string;
  format: "number" | "percent" | "decimal";
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
  favourable: boolean | null;
};

export type SeoWorkCompletion = {
  id: number;
  task_id: number | null;
  completion_month: string;
  completed_at: string;
  task_text: string;
  task_type: string | null;
  task_source: string | null;
  completed_by: number | null;
};

export type SeoMonthlyReportData = {
  version: number;
  generatedAt: string;
  presentation?: {
    brand?: "online_matters" | "neutral";
  };
  narrative?: {
    interpretation?: string;
    caveats?: string;
    generatedBy?: "evidence_rules" | "inzyte_ai";
    reviewed?: boolean;
    reviewedAt?: string;
  };
  period: {
    reportingMonth: string;
    currentStart: string;
    currentEnd: string;
    previousStart: string;
    previousEnd: string;
  };
  assignment: {
    id: number;
    name: string;
    description: string | null;
    category: string | null;
    createdAt: string;
    recurring: boolean;
  };
  sources: Record<string, unknown>;
  work: {
    current: SeoWorkCompletion[];
    allTime: SeoWorkCompletion[];
    allTimeCount: number;
    allTimeNoteCount: number;
    currentInternalActivity: Array<Record<string, unknown>>;
    allTimeInternalActivity: Array<Record<string, unknown>>;
  };
  financialSnapshot?: Record<string, unknown>;
  evidence?: {
    counts?: {
      assignment?: number;
      completedWork?: number;
      cardComments?: number;
      sentEmails?: number;
      otherNotes?: number;
    };
    gmailStatus?: "connected" | "not_connected" | "no_match" | "failed";
    current?: Array<{
      id: string;
      kind:
        | "assignment"
        | "completed_work"
        | "card_comment"
        | "sent_email"
        | "note";
      date: string | null;
      title: string;
      excerpt: string;
      currentPeriod: boolean;
    }>;
    allTime?: Array<{
      id: string;
      kind:
        | "assignment"
        | "completed_work"
        | "card_comment"
        | "sent_email"
        | "note";
      date: string | null;
      title: string;
      excerpt: string;
      currentPeriod: boolean;
    }>;
    safety?: string;
  };
};

export type SeoMonthlyReportSummary = {
  id: number;
  deal_id: number;
  reporting_month: string;
  status: "draft" | "final";
  title: string;
  headline_metrics: SeoMonthlyHeadlineMetric[];
  current_work_count: number;
  all_time_work_count: number;
  generated_at: string;
  finalized_at: string | null;
};

export type SeoMonthlyReport = SeoMonthlyReportSummary & {
  company_id: number | null;
  current_start: string;
  current_end: string;
  previous_start: string;
  previous_end: string;
  data_through: string | null;
  client_summary: string | null;
  work_summary: string | null;
  next_steps: string | null;
  report_data: SeoMonthlyReportData;
  updated_at: string;
};

export type MoneybirdDocumentCandidate = {
  id: string;
  state: string;
  reference?: string | null;
  amountExcludingTax?: string | null;
  amountIncludingTax?: string | null;
  description?: string | null;
  date?: string | null;
  dueDate?: string | null;
  confidence?: "exact_reference" | "strong" | "possible";
  reasons?: string[];
};

export type MoneybirdDocumentCheck = {
  linked: boolean;
  document?: MoneybirdDocumentCandidate;
  administrationId?: string;
  checked: boolean;
  checkedAt?: string;
  reconciled?: boolean;
  warning?: string;
  candidates: MoneybirdDocumentCandidate[];
};

export type MoneybirdDealStatus = {
  estimate: MoneybirdDocumentCheck;
  invoice: MoneybirdDocumentCheck;
};

export type InzyteRequest = {
  action: string;
  dealId: Identifier;
  [key: string]: unknown;
};

export type DealNote = {
  deal_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  activity_source?: ActivitySource;
  activity_source_author?: string | null;
  source_event_id?: string | null;
  attachments?: AttachmentNote[];
  status?: string;
} & Pick<RaRecord, "id">;

export type Tag = {
  id: number;
  name: string;
  color: string;
};

export type TaskSource = "manual" | "trello" | "auto";

export type Task = {
  // A task is anchored to a contact, a deal, or both. Trello-synced deal steps
  // carry a deal_id and no contact_id.
  contact_id?: Identifier | null;
  deal_id?: Identifier | null;
  type: string;
  text: string;
  due_date: string;
  done_date?: string | null;
  sales_id?: Identifier;
  // 'trello' tasks mirror a checklist item; 'auto' is the dated fallback the
  // CRM creates while a deal has no concrete manual/Trello next step.
  source?: TaskSource;
  trello_checkitem_id?: string | null;
} & Pick<RaRecord, "id">;

export type ActivityCompanyCreated = {
  type: typeof COMPANY_CREATED;
  company_id: Identifier;
  company: Company;
  sales_id: Identifier;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactCreated = {
  type: typeof CONTACT_CREATED;
  company_id: Identifier;
  sales_id?: Identifier;
  contact: Contact;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactNoteCreated = {
  type: typeof CONTACT_NOTE_CREATED;
  sales_id?: Identifier;
  contactNote: ContactNote;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityDealCreated = {
  type: typeof DEAL_CREATED;
  company_id: Identifier;
  sales_id?: Identifier;
  deal: Deal;
  date: string;
};

export type ActivityDealNoteCreated = {
  type: typeof DEAL_NOTE_CREATED;
  sales_id?: Identifier;
  dealNote: DealNote;
  date: string;
};

export type Activity = RaRecord &
  (
    | ActivityCompanyCreated
    | ActivityContactCreated
    | ActivityContactNoteCreated
    | ActivityDealCreated
    | ActivityDealNoteCreated
  );

export interface RAFile {
  src: string;
  title: string;
  path?: string;
  rawFile: File;
  type?: string;
}

export type AttachmentNote = RAFile;

export interface LabeledValue {
  value: string;
  label: string;
}

export type DealStage = LabeledValue;

export interface NoteStatus extends LabeledValue {
  color: string;
}

export interface ContactGender {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}
