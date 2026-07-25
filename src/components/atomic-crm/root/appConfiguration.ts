// Gedeelde configuratie voor zowel de productie-app (src/App.tsx) als de
// demo/FakeRest-app (demo/App.tsx), zodat beide dezelfde Nederlandse labels
// en waarden tonen in plaats van de Engelse Atomic CRM-standaardwaarden.

// BANKAI: knipoog naar het kanban-dealbord (en de ultieme vorm uit Bleach) —
// de samenwerking Marketingbende × Online Matters op volle kracht.
export const title = "BANKAI CRM";

export const currency = "EUR";

// The board is one left-to-right production line. The internal values are the
// contract (billing, reporting and the Trello sync rely on them) and never
// change; the labels are what people read, so they carry no Trello list numbers
// -- the column order already says what comes first.
export const dealStages = [
  {
    value: "informatie-pipeline",
    label: "Nog niet bevestigd",
    shortLabel: "Onbevestigd",
  },
  { value: "bevestigd-inplannen", label: "Inplannen", shortLabel: "Inplannen" },
  { value: "on-hold", label: "Wacht op input", shortLabel: "Wacht" },
  { value: "bezig", label: "Bezig", shortLabel: "Bezig" },
  {
    value: "controle-livegang",
    label: "Controle en livegang",
    shortLabel: "Controle",
  },
  {
    value: "facturatie-live",
    label: "Te factureren",
    shortLabel: "Factureren",
  },
  { value: "won", label: "Afgerond", shortLabel: "Afgerond" },
  { value: "maandelijks", label: "Vaste klanten", shortLabel: "Maandelijks" },
];

/** Compact labels keyed by stage value, for chips and one-line summaries. */
export const dealStageShortLabels: Record<string, string> = Object.fromEntries(
  dealStages.map((stage) => [stage.value, stage.shortLabel ?? stage.label]),
);

export const dealPipelineStatuses = ["won"];

export const dealCategories = [
  { value: "seo", label: "SEO" },
  { value: "eenmalig", label: "Eenmalig project" },
  { value: "website-development", label: "Websiteontwikkeling" },
  { value: "website-optimalisatie", label: "Websiteoptimalisatie" },
  { value: "happr", label: "Happr.nl" },
  { value: "overig", label: "Overig" },
];

export const companySectors = [
  { value: "communicatiediensten", label: "Communicatiediensten" },
  {
    value: "cyclische-consumentengoederen",
    label: "Cyclische consumentengoederen",
  },
  {
    value: "niet-cyclische-consumentengoederen",
    label: "Niet-cyclische consumentengoederen",
  },
  { value: "energie", label: "Energie" },
  { value: "financiele-dienstverlening", label: "Financiële dienstverlening" },
  { value: "gezondheidszorg", label: "Gezondheidszorg" },
  { value: "industrie", label: "Industrie" },
  { value: "informatietechnologie", label: "Informatietechnologie" },
  { value: "basismaterialen", label: "Basismaterialen" },
  { value: "vastgoed", label: "Vastgoed" },
  { value: "nutsbedrijven", label: "Nutsbedrijven" },
];

export const noteStatuses = [
  { value: "cold", label: "Koud", color: "#7dbde8" },
  { value: "warm", label: "Warm", color: "#e8cb7d" },
  { value: "hot", label: "Heet", color: "#e88b7d" },
  { value: "in-contract", label: "In contract", color: "#a4e87d" },
];

export const taskTypes = [
  { value: "none", label: "Geen" },
  { value: "email", label: "E-mail" },
  { value: "demo", label: "Demo" },
  { value: "lunch", label: "Lunch" },
  { value: "meeting", label: "Vergadering" },
  { value: "follow-up", label: "Opvolgen" },
  { value: "thank-you", label: "Bedankje" },
  { value: "ship", label: "Opleveren" },
  { value: "call", label: "Bellen" },
];
