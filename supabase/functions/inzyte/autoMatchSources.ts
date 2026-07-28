/**
 * Meetbronnen koppelen zichzelf zodra de website van de opdracht ze aanwijst.
 *
 * De koppeling was tot nu toe handwerk: per opdracht een site uit een keuzelijst
 * kiezen. Dat is precies het soort stap die maandenlang blijft liggen, en zolang
 * hij ligt ontbreekt die bron in elke rapportage zonder dat iemand het merkt.
 * Terwijl de opdracht de website al weet en Search Console de sites al teruggeeft.
 *
 * Daarom matchen we automatisch, maar alleen wanneer het ONDUBBELZINNIG is. Een
 * verkeerde bron is veel schadelijker dan een lege: dan rapporteer je cijfers van
 * de verkeerde website aan een klant. We matchen dus uitsluitend op exact dezelfde
 * hostnaam, nooit op gelijkenis, en we weigeren zodra twee kandidaten even goed
 * passen.
 */

export type SearchConsoleSiteRow = {
  siteUrl?: unknown;
  site_url?: unknown;
  url?: unknown;
  permissionLevel?: unknown;
  permission_level?: unknown;
};

/** Hostnaam zonder protocol, zonder www en zonder pad. Leeg als het niets bruikbaars is. */
export const normalizeHost = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const raw = value.trim().toLowerCase();
  if (!raw) return "";
  const withoutScheme = raw
    .replace(/^sc-domain:/, "")
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const host = withoutScheme.split("/")[0].split("?")[0].split("#")[0];
  return host.replace(/^www\./, "").replace(/\.$/, "");
};

const siteUrlOf = (row: SearchConsoleSiteRow): string => {
  for (const key of ["siteUrl", "site_url", "url"] as const) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const permissionOf = (row: SearchConsoleSiteRow): string => {
  for (const key of ["permissionLevel", "permission_level"] as const) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }
  return "";
};

/**
 * Een property waar we alleen "unverified user" op zijn levert geen cijfers op.
 * Die willen we niet stilzwijgend koppelen, want dan lijkt de bron geregeld
 * terwijl elke ophaling leeg blijft.
 */
const isUsable = (row: SearchConsoleSiteRow): boolean => {
  const permission = permissionOf(row);
  return permission === "" || !permission.includes("unverified");
};

/**
 * Domeinproperty's (`sc-domain:`) dekken alle subdomeinen en beide protocollen en
 * zijn daarmee bijna altijd de betere keuze. Daarna pas een URL-voorvoegsel.
 */
const rank = (siteUrl: string): number => {
  if (/^sc-domain:/i.test(siteUrl)) return 0;
  if (/^https:\/\//i.test(siteUrl)) return 1;
  return 2;
};

export type AutoMatchResult = {
  siteUrl: string | null;
  reason: "matched" | "no_website" | "no_sites" | "no_match" | "ambiguous";
};

/**
 * Zoekt de Search Console-property die bij de website van de opdracht hoort.
 *
 * Geeft `null` terug zodra er twijfel is. De aanroeper laat de koppeling dan leeg
 * staan, zodat een mens hem bewust kiest.
 */
export const matchSearchConsoleSite = (
  websiteUrl: unknown,
  rows: SearchConsoleSiteRow[] | null | undefined,
): AutoMatchResult => {
  const host = normalizeHost(websiteUrl);
  if (!host) return { siteUrl: null, reason: "no_website" };
  if (!Array.isArray(rows) || rows.length === 0) {
    return { siteUrl: null, reason: "no_sites" };
  }

  const candidates = rows
    .filter(isUsable)
    .map((row) => siteUrlOf(row))
    .filter((siteUrl) => siteUrl && normalizeHost(siteUrl) === host);

  if (candidates.length === 0) return { siteUrl: null, reason: "no_match" };

  const sorted = [...candidates].sort((a, b) => rank(a) - rank(b));
  // Twee kandidaten van dezelfde soort betekent dat wij niet kunnen bepalen welke
  // de klant bedoelt. Dan liever niets koppelen dan de verkeerde.
  if (sorted.length > 1 && rank(sorted[0]) === rank(sorted[1])) {
    return { siteUrl: null, reason: "ambiguous" };
  }
  return { siteUrl: sorted[0], reason: "matched" };
};
