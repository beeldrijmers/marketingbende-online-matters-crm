import type { Deal, InzyteLink } from "../../types";

export type InzyteSourceKey = "ga4" | "gsc" | "gbp" | "ads";
export type InzyteVerificationFilter = "active" | "review" | "none";

export type InzyteSourceState = {
  key: InzyteSourceKey;
  shortLabel: string;
  label: string;
  configured: boolean;
  verified: boolean;
  verifiedAt: string | null;
};

const SOURCE_DEFINITIONS: Array<{
  key: InzyteSourceKey;
  shortLabel: string;
  label: string;
  configured: (link: InzyteLink) => boolean;
  verifiedAt: (link: InzyteLink) => string | null | undefined;
}> = [
  {
    key: "ga4",
    shortLabel: "GA4",
    label: "GA4",
    configured: (link) =>
      Boolean(link.ga4_connection_id && link.ga4_property_id),
    verifiedAt: (link) => link.ga4_verified_at,
  },
  {
    key: "gsc",
    shortLabel: "GSC",
    label: "Search Console",
    configured: (link) => Boolean(link.gsc_site_url),
    verifiedAt: (link) => link.gsc_verified_at,
  },
  {
    key: "gbp",
    shortLabel: "GBP",
    label: "Bedrijfsprofiel",
    configured: (link) => Boolean(link.gbp_location_id),
    verifiedAt: (link) => link.gbp_verified_at,
  },
  {
    key: "ads",
    shortLabel: "Ads",
    label: "Google Ads",
    configured: (link) => Boolean(link.ads_customer_id),
    verifiedAt: (link) => link.ads_verified_at,
  },
];

export const getInzyteSourceStates = (
  link: InzyteLink | null | undefined,
): InzyteSourceState[] =>
  SOURCE_DEFINITIONS.map((source) => {
    const configured = link ? source.configured(link) : false;
    const verifiedAt = link ? source.verifiedAt(link) || null : null;
    return {
      key: source.key,
      shortLabel: source.shortLabel,
      label: source.label,
      configured,
      verified: configured && Boolean(verifiedAt),
      verifiedAt,
    };
  });

export const isInzyteSourceVerified = (
  link: InzyteLink | null | undefined,
  key: InzyteSourceKey,
): boolean =>
  getInzyteSourceStates(link).some(
    (source) => source.key === key && source.verified,
  );

export const getInzyteConnectionSummary = (
  link: InzyteLink | null | undefined,
): {
  label: string;
  tone: "success" | "warning" | "error" | "neutral";
  configuredCount: number;
  verifiedCount: number;
} => {
  if (!link) {
    return {
      label: "Nog niet ingesteld",
      tone: "neutral",
      configuredCount: 0,
      verifiedCount: 0,
    };
  }

  const sources = getInzyteSourceStates(link);
  const configured = sources.filter((source) => source.configured);
  const verified = sources.filter((source) => source.verified);

  if (link.last_error) {
    return {
      label: "Koppeling vraagt aandacht",
      tone: "error",
      configuredCount: configured.length,
      verifiedCount: verified.length,
    };
  }

  if (verified.length > 0 && verified.length === configured.length) {
    return {
      label:
        verified.length === 1
          ? `${verified[0].label}-bron gecontroleerd`
          : `${verified.length} meetbronnen gecontroleerd`,
      tone: "success",
      configuredCount: configured.length,
      verifiedCount: verified.length,
    };
  }

  if (verified.length > 0) {
    return {
      label: `${verified.length} gecontroleerd · ${
        configured.length - verified.length
      } controle nodig`,
      tone: "warning",
      configuredCount: configured.length,
      verifiedCount: verified.length,
    };
  }

  if (configured.length === 1) {
    return {
      label: `${configured[0].label} ingesteld, controle nodig`,
      tone: "warning",
      configuredCount: 1,
      verifiedCount: 0,
    };
  }

  if (configured.length > 1) {
    return {
      label: `${configured.length} bronnen ingesteld, controle nodig`,
      tone: "warning",
      configuredCount: configured.length,
      verifiedCount: 0,
    };
  }

  return {
    label: "Account ingesteld, meetbron ontbreekt",
    tone: "warning",
    configuredCount: 0,
    verifiedCount: 0,
  };
};

export const matchesInzyteVerificationFilter = (
  deal: Deal,
  filter: InzyteVerificationFilter | undefined,
): boolean => {
  if (!filter) return true;
  const summary = getInzyteConnectionSummary(deal.inzyte_link);
  if (filter === "active") return summary.tone === "success";
  if (filter === "review") {
    return Boolean(
      deal.inzyte_link &&
        summary.tone !== "success" &&
        (summary.configuredCount > 0 || deal.inzyte_link.last_error),
    );
  }
  return Boolean(
    !deal.inzyte_link ||
      (summary.configuredCount === 0 && !deal.inzyte_link.last_error),
  );
};
