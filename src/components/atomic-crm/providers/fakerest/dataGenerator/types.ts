import type {
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  DealStatusUpdate,
  IntegrationRun,
  Sale,
  Tag,
  Task,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  companies: Company[];
  contacts: Contact[];
  contact_notes: ContactNote[];
  deals: Deal[];
  deal_notes: DealNote[];
  deal_status_updates: DealStatusUpdate[];
  integration_runs: IntegrationRun[];
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
