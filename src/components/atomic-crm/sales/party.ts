import type { PartyKey, Sale } from "../types";

/**
 * Party seam for the collaboration layer.
 *
 * The three collaborating parties are Online Matters, Marketingbende and
 * Groeien met Ads. `PartyKey` lives in types.ts (single source of truth); this
 * module maps each key to its label + colour and reads the value defensively
 * from a sale record.
 */
export type { PartyKey };

export interface PartyMeta {
  labelKey: string;
  fallback: string;
  className: string;
}

export const PARTY_META: Record<PartyKey, PartyMeta> = {
  online_matters: {
    labelKey: "crm.ownership.party.online_matters",
    fallback: "Online Matters",
    className:
      "border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300",
  },
  marketingbende: {
    labelKey: "crm.ownership.party.marketingbende",
    fallback: "Marketingbende",
    className:
      "border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300",
  },
  groeien_met_ads: {
    labelKey: "crm.ownership.party.groeien_met_ads",
    fallback: "Groeien met Ads",
    className:
      "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300",
  },
};

/** Ordered options for party selects/filters (value + fallback label). */
export const PARTY_OPTIONS: { value: PartyKey; fallback: string }[] = (
  Object.keys(PARTY_META) as PartyKey[]
).map((value) => ({ value, fallback: PARTY_META[value].fallback }));

export const getSaleParty = (
  sale?: Partial<Sale> | null,
): PartyKey | undefined => {
  const value = sale?.partij;
  return value != null && value in PARTY_META ? value : undefined;
};

export const saleFullName = (sale?: Partial<Sale> | null): string =>
  sale ? `${sale.first_name ?? ""} ${sale.last_name ?? ""}`.trim() : "";
