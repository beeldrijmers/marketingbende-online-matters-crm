import { CRM } from "@/components/atomic-crm/root/CRM";
import {
  companySectors,
  currency,
  dealCategories,
  dealPipelineStatuses,
  dealStages,
  noteStatuses,
  taskTypes,
  title,
} from "@/components/atomic-crm/root/appConfiguration";

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
    title={title}
    currency={currency}
    dealStages={dealStages}
    dealPipelineStatuses={dealPipelineStatuses}
    dealCategories={dealCategories}
    companySectors={companySectors}
    noteStatuses={noteStatuses}
    taskTypes={taskTypes}
  />
);

export default App;
