// Gedeelde configuratie voor zowel de productie-app (src/App.tsx) als de
// demo/FakeRest-app (demo/App.tsx), zodat beide dezelfde Nederlandse labels
// en waarden tonen in plaats van de Engelse Atomic CRM-standaardwaarden.

// BANKAI: knipoog naar het kanban-dealbord (en de ultieme vorm uit Bleach) —
// de samenwerking Marketingbende × Online Matters op volle kracht.
export const title = "BANKAI CRM";

export const currency = "EUR";

// The kanban is a single left-to-right "loopband" from start to finished. The
// four stages are the conveyor; "on hold" is not a column but a marking on the
// card (deals.on_hold), so a parked deal stays in its current stage instead of
// piling up in a separate stack. Stage values are kept stable (the final stage
// keeps the internal value "won" - RevenueDashboard keys off
// "won"/"lost" - and "informatie-pipeline" stays the first-stage value the
// monthly cycle resets to), only the labels changed.
export const dealStages = [
  { value: "informatie-pipeline", label: "Nieuw" },
  { value: "bezig", label: "Bezig" },
  { value: "facturatie-live", label: "Facturatie / live" },
  { value: "won", label: "Klaar" },
];

export const dealPipelineStatuses = ["won"];

export const dealCategories = [
  { value: "seo", label: "SEO" },
  { value: "eenmalig", label: "Eenmalig project" },
  { value: "website-development", label: "Website development" },
  { value: "website-optimalisatie", label: "Website optimalisatie" },
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
