import {
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  MoreVertical,
} from "lucide-react";
import {
  useGetIdentity,
  useGetOne,
  useLogout,
  useStore,
  useTranslate,
  UserMenuContext,
} from "ra-core";
import { useCallback, useState } from "react";
import { Link, useLocation } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { getSaleParty, PARTY_META } from "../sales/party";
import type { Sale } from "../types";
import { isNavItemActive, NAVIGATION, type NavItem } from "./navigation";
import { useNavigationCounts } from "./useNavigationCounts";
import { UserMenuItems } from "./UserMenuItems";
import { Wordmark } from "./Wordmark";

const COLLAPSED_STORE_KEY = "crm.sidebar.collapsed";

/**
 * The desktop shell's one navigation surface.
 *
 * Everything the CRM can do is reachable from here — before, the top bar
 * offered two links and the board itself lived three levels deep inside a
 * dashboard tab. Counters make the rail answer "what is waiting?" without a
 * click.
 */
export const AppSidebar = () => {
  const translate = useTranslate();
  const [collapsed, setCollapsed] = useStore<boolean>(
    COLLAPSED_STORE_KEY,
    false,
  );
  const location = useLocation();
  const counts = useNavigationCounts();

  return (
    <div
      data-collapsed={collapsed ? "true" : undefined}
      className={cn(
        "hidden shrink-0 flex-col border-r border-line-subtle bg-sidebar transition-[width] duration-2 md:flex",
        collapsed ? "w-[4.25rem]" : "w-[15rem]",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <Link
          to="/"
          className="flex min-w-0 items-center rounded-md no-underline focus-visible:outline-none focus-visible:ring-0"
          title="Marketingbende × Online Matters"
        >
          <Wordmark compact={collapsed} />
        </Link>
      </div>

      <nav
        aria-label={translate("crm.navigation.label", { _: "Hoofdnavigatie" })}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-4 pt-1",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {NAVIGATION.map((group, index) => (
          <div key={group.labelKey ?? index} className="flex flex-col gap-0.5">
            {group.labelKey && !collapsed ? (
              <p className="eyebrow mb-1 px-2">
                {translate(group.labelKey, { _: group.fallback ?? "" })}
              </p>
            ) : null}
            {group.labelKey && collapsed ? (
              <div className="mx-2 mb-1.5 h-px bg-line-subtle" />
            ) : null}
            {group.items.map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                active={isNavItemActive(item, location.pathname)}
                collapsed={collapsed}
                count={item.badge ? counts[item.badge] : undefined}
              />
            ))}
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "flex shrink-0 flex-col gap-1 border-t border-line-subtle py-2",
          collapsed ? "items-center px-2" : "px-3",
        )}
      >
        <AccountChip collapsed={collapsed} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={translate(
            collapsed ? "crm.navigation.expand" : "crm.navigation.collapse",
            { _: collapsed ? "Menu uitklappen" : "Menu inklappen" },
          )}
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "h-8 text-ink-3 hover:text-ink",
            collapsed ? "w-9 justify-center px-0" : "justify-start gap-2 px-2",
          )}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <>
              <ChevronsLeft className="size-4" />
              <span className="text-meta">
                {translate("crm.navigation.collapse", { _: "Inklappen" })}
              </span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

const SidebarLink = ({
  active,
  collapsed,
  count,
  item,
}: {
  active: boolean;
  collapsed: boolean;
  count?: number;
  item: NavItem;
}) => {
  const translate = useTranslate();
  const label = translate(item.labelKey, {
    smart_count: 2,
    _: item.fallback,
  });
  const Icon = item.icon;
  const showCount = count != null && count > 0;
  const urgent = showCount && item.badge !== "to-invoice";

  const link = (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center rounded-md text-body no-underline transition-colors duration-1",
        collapsed ? "w-9 justify-center px-0" : "gap-2.5 px-2",
        active
          ? "bg-accent-quiet font-medium text-ink"
          : "text-ink-2 hover:bg-raised hover:text-ink",
      )}
    >
      <span className="relative flex shrink-0 items-center">
        <Icon
          className={cn(
            "size-4",
            active ? "text-accent-base dark:text-focus" : "text-ink-3",
          )}
        />
        {/* Collapsed, the counter shrinks to a dot on the icon. */}
        {showCount && collapsed ? (
          <span
            className={cn(
              "absolute -right-1.5 -top-1 size-2 rounded-full ring-2 ring-sidebar",
              urgent ? "bg-late" : "bg-ink-3",
            )}
          />
        ) : null}
      </span>
      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      )}
      {showCount && !collapsed ? (
        <span
          className={cn(
            "num min-w-5 rounded-full px-1.5 py-0.5 text-center text-eyebrow tracking-normal",
            urgent
              ? "bg-late-tint text-late"
              : "bg-raised-hi text-ink-2 group-hover:bg-sunken",
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">
        {label}
        {showCount ? ` · ${count}` : ""}
      </TooltipContent>
    </Tooltip>
  );
};

/** Who am I, which agency am I here for, and where do I sign out. */
const AccountChip = ({ collapsed }: { collapsed: boolean }) => {
  const translate = useTranslate();
  const logout = useLogout();
  const { identity } = useGetIdentity();
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);
  const { data: sale } = useGetOne<Sale>(
    "sales",
    { id: identity?.id as string },
    { enabled: identity?.id != null },
  );
  const party = getSaleParty(sale);
  const partyLabel = party
    ? translate(PARTY_META[party].labelKey, { _: PARTY_META[party].fallback })
    : null;

  return (
    <UserMenuContext.Provider value={{ onClose: handleClose }}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center rounded-md text-left transition-colors duration-1 hover:bg-raised",
              collapsed ? "size-9 justify-center" : "gap-2.5 px-2 py-1.5",
            )}
            aria-label={translate("crm.navigation.account", {
              _: "Account en instellingen",
            })}
          >
            <Avatar className="size-7">
              <AvatarImage src={identity?.avatar} role="presentation" />
              <AvatarFallback className="text-eyebrow tracking-normal">
                {identity?.fullName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            {collapsed ? null : (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-meta font-medium text-ink">
                    {identity?.fullName}
                  </span>
                  {partyLabel ? (
                    <span
                      className={cn(
                        "block truncate text-eyebrow tracking-normal",
                        party === "marketingbende"
                          ? "text-party-mb"
                          : party === "online_matters"
                            ? "text-party-om"
                            : "text-party-gma",
                      )}
                    >
                      {partyLabel}
                    </span>
                  ) : null}
                </span>
                <MoreVertical className="size-4 shrink-0 text-ink-3" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <UserMenuItems />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => logout()}>
            <LogOut className="size-4" />
            {translate("ra.auth.logout", { _: "Uitloggen" })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </UserMenuContext.Provider>
  );
};
