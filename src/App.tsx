import { CRM } from "@/components/atomic-crm/root/CRM";

// Stage values mirror the "SEO - Online Matters" Trello board's pipeline lists.
// The final stage keeps the internal value "won" (label "Klaar") because
// DealsChart.tsx hardcodes stage === "won"/"lost" for its revenue forecast.
const dealStages = [
  { value: "informatie-pipeline", label: "Informatie + pipeline" },
  { value: "bezig", label: "Bezig" },
  { value: "on-hold", label: "On hold" },
  { value: "facturatie-live", label: "Facturatie + live project" },
  { value: "won", label: "Klaar" },
];

const dealPipelineStatuses = ["won"];

const dealCategories = [
  { value: "seo", label: "SEO" },
  { value: "eenmalig", label: "Eenmalig project" },
  { value: "website-development", label: "Website development" },
  { value: "website-optimalisatie", label: "Website optimalisatie" },
  { value: "happr", label: "Happr.nl" },
  { value: "overig", label: "Overig" },
];

/**
 * Application entry point
 *
 * Customize Atomic CRM by passing props to the CRM component:
 *  - companySectors
 *  - darkTheme
 *  - dealCategories
 *  - dealPipelineStatuses
 *  - dealStages
 *  - lightTheme
 *  - logo
 *  - noteStatuses
 *  - taskTypes
 *  - title
 * ... as well as all the props accepted by shadcn-admin-kit's <Admin> component.
 *
 * @example
 * const App = () => (
 *    <CRM
 *       logo="./img/logo.png"
 *       title="Acme CRM"
 *    />
 * );
 */
const App = () => (
  <CRM
    title="Marketingbende x Online Matters CRM"
    currency="EUR"
    dealStages={dealStages}
    dealPipelineStatuses={dealPipelineStatuses}
    dealCategories={dealCategories}
  />
);

export default App;
