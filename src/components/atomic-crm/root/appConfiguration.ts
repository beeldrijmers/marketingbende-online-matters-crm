// Gedeelde configuratie voor zowel de productie-app (src/App.tsx) als de
// demo/FakeRest-app (demo/App.tsx), zodat beide dezelfde Nederlandse labels
// en waarden tonen in plaats van de Engelse Atomic CRM-standaardwaarden.

// BANKAI: knipoog naar het kanban-dealbord (en de ultieme vorm uit Bleach) —
// de samenwerking Marketingbende × Online Matters op volle kracht.
export const title = "BANKAI CRM";

export const currency = "EUR";

// The kanban mirrors Trello's numbered left-to-right production line. Existing
// internal values stay in place where billing/reporting relies on them; three
// additional values represent the newly explicit planning, review and monthly
// columns.
export const dealStages = [
  { value: "informatie-pipeline", label: "00 · Nog niet bevestigd" },
  { value: "bevestigd-inplannen", label: "10 · Bevestigd / inplannen" },
  { value: "on-hold", label: "20 · Wacht op input / geblokkeerd" },
  { value: "bezig", label: "30 · Bezig" },
  { value: "controle-livegang", label: "40 · Controle / akkoord / livegang" },
  { value: "facturatie-live", label: "50 · Klaar / te factureren" },
  { value: "won", label: "60 · Gefactureerd / afgerond" },
  { value: "maandelijks", label: "70 · Maandelijks / vaste klanten" },
];

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
