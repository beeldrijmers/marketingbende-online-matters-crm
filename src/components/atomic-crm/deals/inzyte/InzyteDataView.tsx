import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  isInzyteRecord,
  type InzyteJsonRecord,
  unwrapInzyteData,
} from "./inzyteData";

type JsonRecord = InzyteJsonRecord;
const isRecord = isInzyteRecord;

const FIELD_LABELS: Record<string, string> = {
  account: "Account",
  actions: "Acties",
  activeusers: "Actieve gebruikers",
  ads: "Advertenties",
  averagesessionduration: "Gemiddelde sessieduur",
  averageengagementtime: "Gemiddelde betrokkenheidstijd",
  averageordervalue: "Gemiddelde bestelwaarde",
  bouncerate: "Bouncepercentage",
  browser: "Browser",
  campaign: "Campagne",
  campaigns: "Campagnes",
  channel: "Kanaal",
  channels: "Kanalen",
  city: "Plaats",
  clicks: "Klikken",
  connected: "Verbonden",
  content: "Inhoud",
  conversionrate: "Conversiepercentage",
  conversions: "Conversies",
  cost: "Kosten",
  count: "Aantal",
  country: "Land",
  cpa: "Kosten per acquisitie",
  cpc: "Kosten per klik",
  ctr: "Klikratio",
  current: "Huidige periode",
  customerid: "Klantnummer",
  date: "Datum",
  daterange: "Periode",
  device: "Apparaat",
  devicecategory: "Apparaattype",
  dimensions: "Dimensies",
  duration: "Duur",
  enabled: "Ingeschakeld",
  engagementrate: "Betrokkenheidspercentage",
  engagementtime: "Betrokkenheidstijd",
  eventcount: "Aantal gebeurtenissen",
  eventname: "Gebeurtenis",
  events: "Gebeurtenissen",
  impressions: "Vertoningen",
  insights: "Inzichten",
  itemcategory: "Productcategorie",
  itemname: "Product",
  items: "Onderdelen",
  language: "Taal",
  landingpage: "Landingspagina",
  location: "Locatie",
  medium: "Medium",
  name: "Naam",
  newusers: "Nieuwe gebruikers",
  operatingystem: "Besturingssysteem",
  operatingsystem: "Besturingssysteem",
  organicusers: "Organische gebruikers",
  pages: "Pagina’s",
  pagetitle: "Paginatitel",
  pageviews: "Paginaweergaven",
  path: "Pad",
  position: "Gemiddelde positie",
  previous: "Vorige periode",
  productrevenue: "Productomzet",
  propertyname: "Propertynaam",
  purchases: "Aankopen",
  queries: "Zoekopdrachten",
  query: "Zoekopdracht",
  recommendations: "Aanbevelingen",
  results: "Resultaten",
  revenue: "Omzet",
  roas: "Rendement op advertentiekosten",
  rows: "Resultaten",
  screenpageviews: "Paginaweergaven",
  sessions: "Sessies",
  source: "Bron",
  status: "Status",
  success: "Geslaagd",
  summary: "Samenvatting",
  total: "Totaal",
  totalrevenue: "Totale omzet",
  totalusers: "Totaal gebruikers",
  trend: "Ontwikkeling",
  users: "Gebruikers",
  value: "Waarde",
  views: "Weergaven",
  visitors: "Bezoekers",
};

const formatNumber = (value: number): string => {
  if (Number.isInteger(value)) return value.toLocaleString("nl-NL");
  return value.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
};

const formatScalar = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ja" : "Nee";
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(parsed)) {
      return new Intl.DateTimeFormat("nl-NL", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(parsed));
    }
    return value;
  }
  return JSON.stringify(value);
};

const humanize = (value: string): string => {
  const spaced = value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  const translation = FIELD_LABELS[spaced.replaceAll(" ", "").toLowerCase()];
  return (
    translation || spaced.replace(/^./, (character) => character.toUpperCase())
  );
};

const findKpis = (value: unknown, depth = 0): JsonRecord | null => {
  if (depth > 5 || !isRecord(value)) return null;
  if (isRecord(value.kpis)) return value.kpis;
  for (const child of Object.values(value)) {
    const found = findKpis(child, depth + 1);
    if (found) return found;
  }
  return null;
};

type NamedRows = { name: string; rows: JsonRecord[] };

const collectRowSets = (
  value: unknown,
  name = "Resultaten",
  depth = 0,
  output: NamedRows[] = [],
): NamedRows[] => {
  if (depth > 6 || output.length >= 8) return output;
  if (Array.isArray(value)) {
    const rows = value.filter(isRecord).slice(0, 100);
    if (rows.length > 0) output.push({ name: humanize(name), rows });
    return output;
  }
  if (!isRecord(value)) return output;
  for (const [key, child] of Object.entries(value)) {
    collectRowSets(child, key, depth + 1, output);
    if (output.length >= 8) break;
  }
  return output;
};

const KpiGrid = ({ kpis }: { kpis: JsonRecord }) => (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
    {Object.entries(kpis)
      .slice(0, 12)
      .map(([key, raw]) => {
        const value = isRecord(raw) ? raw.current : raw;
        const delta = isRecord(raw) ? raw.deltaPct : null;
        const numericDelta = typeof delta === "number" ? delta : null;
        return (
          <div key={key} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-xs font-medium text-muted-foreground">
              {humanize(key)}
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">
              {formatScalar(value)}
            </div>
            {numericDelta !== null ? (
              <Badge
                variant="outline"
                className={
                  numericDelta >= 0
                    ? "mt-2 border-emerald-500/40 text-emerald-600"
                    : "mt-2 border-rose-500/40 text-rose-600"
                }
              >
                {numericDelta > 0 ? "+" : ""}
                {numericDelta.toLocaleString("nl-NL")}% t.o.v. vorige periode
              </Badge>
            ) : null}
          </div>
        );
      })}
  </div>
);

const RowTable = ({ name, rows }: NamedRows) => {
  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.slice(0, 20).forEach((row) =>
      Object.entries(row).forEach(([key, value]) => {
        if (!isRecord(value) && !Array.isArray(value)) keys.add(key);
      }),
    );
    return Array.from(keys).slice(0, 10);
  }, [rows]);

  if (columns.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold">{name}</h3>
        <Badge variant="secondary">{rows.length} rijen</Badge>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column}>{humanize(column)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 100).map((row, index) => (
              <TableRow key={`${name}-${index}`}>
                {columns.map((column) => (
                  <TableCell key={column} className="max-w-80 align-top">
                    <span className="line-clamp-3 break-words">
                      {formatScalar(row[column])}
                    </span>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
};

const ScalarCards = ({ value }: { value: JsonRecord }) => {
  const rows = Object.entries(value).filter(
    ([, item]) => !isRecord(item) && !Array.isArray(item),
  );
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.slice(0, 16).map(([key, item]) => (
        <div key={key} className="rounded-xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">{humanize(key)}</div>
          <div className="mt-1 break-words font-medium">
            {formatScalar(item)}
          </div>
        </div>
      ))}
    </div>
  );
};

export const InzyteDataView = ({ data }: { data: unknown }) => {
  const [showRaw, setShowRaw] = useState(false);
  const unwrapped = unwrapInzyteData(data);
  const kpis = findKpis(unwrapped);
  const rowSets = collectRowSets(unwrapped);

  if (unwrapped === null || unwrapped === undefined) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Er is nog geen resultaat voor dit onderdeel.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {kpis ? <KpiGrid kpis={kpis} /> : null}
      {isRecord(unwrapped) ? <ScalarCards value={unwrapped} /> : null}
      {rowSets.map((rowSet) => (
        <RowTable key={`${rowSet.name}-${rowSet.rows.length}`} {...rowSet} />
      ))}
      {typeof unwrapped === "string" ? (
        <div className="whitespace-pre-wrap rounded-xl border bg-card p-5 leading-7">
          {unwrapped}
        </div>
      ) : null}
      <div className="rounded-xl border bg-muted/20">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start"
          onClick={() => setShowRaw((value) => !value)}
        >
          {showRaw ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          Volledige brondata bekijken
        </Button>
        {showRaw ? (
          <pre className="max-h-[480px] overflow-auto border-t p-4 text-xs leading-5">
            {JSON.stringify(unwrapped, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
};
