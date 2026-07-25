/**
 * Every route the app links to, in one place.
 *
 * Paths used to be spread across page modules and a deal-specific helper, which
 * is how the board ended up living at `/?tab=workboard` while three components
 * still linked to `/deals`. Import from here.
 */

export const TODAY_PATH = "/";
export const BOARD_PATH = "/deals";
export const TASKS_PATH = "/tasks";
export const COMPANIES_PATH = "/companies";
export const CONTACTS_PATH = "/contacts";
export const FINANCE_PATH = "/financieel";
export const UPDATES_PATH = "/updates";
export const INTEGRATIONS_PATH = "/koppelingen";
export const SALES_PATH = "/sales";

/** The board, narrowed to the deals that need a person. */
export const DEAL_ATTENTION_PATH = `${BOARD_PATH}?focus=attention`;

/**
 * Kept alive so bookmarks and links in older e-mails keep working.
 * `/deals/facturatie` now lands on the finance page, where the invoicing queue
 * actually lives.
 */
export const LEGACY_DEAL_ATTENTION_PATH = "/deals/aandacht";
export const LEGACY_DEAL_BILLING_PATH = "/deals/facturatie";
