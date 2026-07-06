import type { ConfigurationContextValue } from "./ConfigurationContext";
import {
  companySectors,
  currency,
  dealCategories,
  dealPipelineStatuses,
  dealStages,
  noteStatuses,
  taskTypes,
  title,
} from "./appConfiguration";

// The defaults mirror appConfiguration so that the app renders the real
// Marketingbende x Online Matters configuration even when the localStorage
// seed is missing (e.g. right after logout, which clears the stored config).
// Before this, an empty store fell back to the generic Atomic CRM stages
// ("opportunity"/"won"), breaking the kanban grouping and chart labels.
export const defaultDarkModeLogo = "./logos/bankai_dark.svg";
export const defaultLightModeLogo = "./logos/bankai_light.svg";

export const defaultCurrency = currency;

export const defaultTitle = title;

export const defaultCompanySectors = companySectors;

export const defaultDealStages = dealStages;

export const defaultDealPipelineStatuses = dealPipelineStatuses;

export const defaultDealCategories = dealCategories;

export const defaultNoteStatuses = noteStatuses;

export const defaultTaskTypes = taskTypes;

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
