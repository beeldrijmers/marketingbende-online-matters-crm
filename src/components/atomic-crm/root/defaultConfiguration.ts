import type { ConfigurationContextValue } from "./ConfigurationContext";

export const defaultDarkModeLogo = "./logos/logo_mb_om_dark.svg";
export const defaultLightModeLogo = "./logos/logo_mb_om_light.svg";

export const defaultCurrency = "EUR";

export const defaultTitle = "Marketingbende x Online Matters CRM";

export const defaultCompanySectors = [
  { value: "communication-services", label: "Communicatiediensten" },
  {
    value: "consumer-discretionary",
    label: "Cyclische consumentengoederen",
  },
  {
    value: "consumer-staples",
    label: "Niet-cyclische consumentengoederen",
  },
  { value: "energy", label: "Energie" },
  { value: "financials", label: "Financiële dienstverlening" },
  { value: "health-care", label: "Gezondheidszorg" },
  { value: "industrials", label: "Industrie" },
  { value: "information-technology", label: "Informatietechnologie" },
  { value: "materials", label: "Basismaterialen" },
  { value: "real-estate", label: "Vastgoed" },
  { value: "utilities", label: "Nutsbedrijven" },
];

export const defaultDealStages = [
  { value: "opportunity", label: "Kans" },
  { value: "proposal-sent", label: "Voorstel verstuurd" },
  { value: "in-negociation", label: "In onderhandeling" },
  { value: "won", label: "Gewonnen" },
  { value: "lost", label: "Verloren" },
  { value: "delayed", label: "Vertraagd" },
];

export const defaultDealPipelineStatuses = ["won"];

export const defaultDealCategories = [
  { value: "other", label: "Overig" },
  { value: "copywriting", label: "Copywriting" },
  { value: "print-project", label: "Printproject" },
  { value: "ui-design", label: "UI-ontwerp" },
  { value: "website-design", label: "Websiteontwerp" },
];

export const defaultNoteStatuses = [
  { value: "cold", label: "Koud", color: "#7dbde8" },
  { value: "warm", label: "Warm", color: "#e8cb7d" },
  { value: "hot", label: "Heet", color: "#e88b7d" },
  { value: "in-contract", label: "In contract", color: "#a4e87d" },
];

export const defaultTaskTypes = [
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

export const defaultConfiguration: ConfigurationContextValue = {
  companySectors: defaultCompanySectors,
  currency: defaultCurrency,
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  noteStatuses: defaultNoteStatuses,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
};
