import {
  Activity,
  Building2,
  Cable,
  CircleDollarSign,
  Columns3,
  ListTodo,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The app's destinations, in one place, so the desktop rail and the mobile bar
 * can never drift apart again (they used to disagree: the top bar offered two
 * links while the phone offered five, and neither could reach the board).
 *
 * `badge` names the counter shown behind the label — the counts themselves are
 * resolved in useNavigationCounts so this stays a plain data module.
 */
export type NavBadge = "attention" | "tasks-overdue" | "to-invoice";

export interface NavItem {
  /** i18n key for the label; `fallback` is what Dutch users actually see. */
  labelKey: string;
  fallback: string;
  to: string;
  icon: LucideIcon;
  /** Extra path prefixes that should light this item up. */
  matches?: string[];
  badge?: NavBadge;
  /** Shown in the phone's bottom bar (max five fit). */
  mobile?: boolean;
  /** Bottom-bar label: 60px of width does not fit "Opdrachten". */
  shortFallback?: string;
  shortLabelKey?: string;
}

export interface NavGroup {
  labelKey?: string;
  fallback?: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    items: [
      {
        labelKey: "crm.navigation.today",
        fallback: "Vandaag",
        to: "/",
        icon: Sun,
        mobile: true,
      },
      {
        labelKey: "resources.deals.name",
        fallback: "Opdrachten",
        shortLabelKey: "crm.navigation.board_short",
        shortFallback: "Bord",
        to: "/deals",
        icon: Columns3,
        badge: "attention",
        mobile: true,
      },
      {
        labelKey: "resources.tasks.name",
        fallback: "Taken",
        to: "/tasks",
        icon: ListTodo,
        badge: "tasks-overdue",
        mobile: true,
      },
    ],
  },
  {
    labelKey: "crm.navigation.group_relations",
    fallback: "Relaties",
    items: [
      {
        labelKey: "resources.companies.name",
        fallback: "Klanten",
        to: "/companies",
        icon: Building2,
        mobile: true,
      },
      {
        labelKey: "resources.contacts.name",
        fallback: "Contacten",
        to: "/contacts",
        icon: Users,
        mobile: true,
      },
    ],
  },
  {
    labelKey: "crm.navigation.group_overview",
    fallback: "Overzicht",
    items: [
      {
        labelKey: "crm.navigation.finance",
        fallback: "Financieel",
        to: "/financieel",
        icon: CircleDollarSign,
        badge: "to-invoice",
      },
      {
        labelKey: "crm.navigation.updates",
        fallback: "Updates",
        to: "/updates",
        icon: Activity,
      },
      {
        labelKey: "crm.navigation.integrations",
        fallback: "Koppelingen",
        to: "/koppelingen",
        icon: Cable,
      },
    ],
  },
];

export const MOBILE_NAVIGATION: NavItem[] = NAVIGATION.flatMap(
  ({ items }) => items,
).filter((item) => item.mobile);

/** True when `pathname` belongs to `item` — "/" only matches exactly. */
export const isNavItemActive = (item: NavItem, pathname: string): boolean => {
  const candidates = [item.to, ...(item.matches ?? [])];
  return candidates.some((candidate) =>
    candidate === "/"
      ? pathname === "/"
      : pathname === candidate || pathname.startsWith(`${candidate}/`),
  );
};
