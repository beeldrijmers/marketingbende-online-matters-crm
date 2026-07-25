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

export interface PartyMetaColours {
  /** Text colour for the party name. */
  className: string;
  /** Background for the identity dot. */
  dotClassName: string;
}

export const PARTY_META: Record<PartyKey, PartyMeta & PartyMetaColours> = {
  online_matters: {
    labelKey: "crm.ownership.party.online_matters",
    fallback: "Online Matters",
    className: "text-party-om border-party-om/35",
    dotClassName: "bg-party-om",
  },
  marketingbende: {
    labelKey: "crm.ownership.party.marketingbende",
    fallback: "Marketingbende",
    className: "text-party-mb border-party-mb/35",
    dotClassName: "bg-party-mb",
  },
  groeien_met_ads: {
    labelKey: "crm.ownership.party.groeien_met_ads",
    fallback: "Groeien met Ads",
    className: "text-party-gma border-party-gma/35",
    dotClassName: "bg-party-gma",
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
