import { CRM } from "@/components/atomic-crm/root/CRM";
import {
  authProvider,
  createDataProvider,
} from "@/components/atomic-crm/providers/fakerest";
import generateData from "@/components/atomic-crm/providers/fakerest/dataGenerator";
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
import { memoryStore } from "ra-core";

const dataProvider = createDataProvider({
  db: generateData({ dealStages, dealCategories, companySectors }),
});

const App = () => (
  <CRM
    dataProvider={dataProvider}
    authProvider={authProvider}
    store={memoryStore()}
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
