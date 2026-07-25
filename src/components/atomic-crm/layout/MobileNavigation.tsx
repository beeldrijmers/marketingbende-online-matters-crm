import { Plus } from "lucide-react";
import { useRedirect, useTranslate } from "ra-core";
import { useState } from "react";
import { Link, useLocation, useMatch } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { ContactCreateSheet } from "../contacts/ContactCreateSheet";
import { NoteCreateSheet } from "../notes/NoteCreateSheet";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";
import { getDashboardDealCreatePath } from "../deals/dashboardDealSelection";
import { BOARD_PATH } from "../root/routes";
import { isNavItemActive, MOBILE_NAVIGATION, type NavItem } from "./navigation";
import { useNavigationCounts } from "./useNavigationCounts";

/**
 * The phone's bottom bar, built from the same navigation model as the desktop
 * rail — the two used to disagree about which screens even existed (the board
 * was unreachable on desktop, settings only existed on the phone).
 */
export const MobileNavigation = () => {
  const location = useLocation();
  const translate = useTranslate();
  const counts = useNavigationCounts();

  return (
    <>
      <CreateButton />
      <nav
        aria-label={translate("crm.navigation.label", { _: "Hoofdnavigatie" })}
        // The home-indicator inset comes from the viewport now (index.html sets
        // viewport-fit=cover), instead of being guessed from the user agent.
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line-subtle bg-sidebar"
        style={{ paddingBottom: "var(--safe-b)" }}
      >
        <div className="flex items-stretch justify-around px-1">
          {MOBILE_NAVIGATION.map((item) => (
            <NavigationButton
              key={item.to}
              item={item}
              active={isNavItemActive(item, location.pathname)}
              count={item.badge ? counts[item.badge] : undefined}
            />
          ))}
        </div>
      </nav>
    </>
  );
};

const NavigationButton = ({
  active,
  count,
  item,
}: {
  active: boolean;
  count?: number;
  item: NavItem;
}) => {
  const translate = useTranslate();
  const Icon = item.icon;
  const label = item.shortLabelKey
    ? translate(item.shortLabelKey, { _: item.shortFallback ?? item.fallback })
    : translate(item.labelKey, { smart_count: 2, _: item.fallback });
  const showCount = count != null && count > 0;

  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        // 56px tall, 60px wide: a comfortable thumb target on every phone.
        "flex min-h-14 w-[3.75rem] flex-col items-center justify-center gap-1 rounded-md no-underline transition-transform duration-1 active:scale-95",
        active ? "text-ink" : "text-ink-3",
      )}
    >
      <span className="relative flex items-center">
        <Icon
          className={cn("size-5", active && "text-accent-base dark:text-focus")}
        />
        {showCount ? (
          <span
            className={cn(
              "absolute -right-2 -top-1 size-2 rounded-full ring-2 ring-sidebar",
              item.badge === "to-invoice" ? "bg-ink-3" : "bg-late",
            )}
          />
        ) : null}
      </span>
      <span
        className={cn(
          "max-w-full truncate text-[0.6875rem] leading-none",
          active ? "font-semibold" : "font-medium",
        )}
      >
        {label}
      </span>
    </Link>
  );
};

const CreateButton = () => {
  const translate = useTranslate();
  const location = useLocation();
  const redirect = useRedirect();
  const contact_id = useMatch("/contacts/:id/*")?.params.id;
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);

  // The button used to offer the same three options everywhere and could not
  // create the one record the board is made of.
  const onBoard = location.pathname.startsWith(BOARD_PATH);

  return (
    <>
      <ContactCreateSheet
        open={contactCreateOpen}
        onOpenChange={setContactCreateOpen}
      />
      <NoteCreateSheet
        open={noteCreateOpen}
        onOpenChange={setNoteCreateOpen}
        contact_id={contact_id}
      />
      <TaskCreateSheet
        open={taskCreateOpen}
        onOpenChange={setTaskCreateOpen}
        contact_id={contact_id}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            size="icon"
            className="fixed right-4 z-50 size-12 rounded-full shadow-e3"
            style={{
              bottom: "calc(var(--bottom-nav-h) + var(--safe-b) + 0.75rem)",
            }}
            aria-label={translate("ra.action.create")}
          >
            <Plus className="size-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          {onBoard ? (
            <DropdownMenuItem
              className="h-11 px-4 text-body"
              onSelect={() => redirect(getDashboardDealCreatePath(BOARD_PATH))}
            >
              {translate("resources.deals.forcedCaseName", {
                _: "Opdracht",
              })}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className="h-11 px-4 text-body"
            onSelect={() => setContactCreateOpen(true)}
          >
            {translate("resources.contacts.forcedCaseName")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-11 px-4 text-body"
            onSelect={() => setNoteCreateOpen(true)}
          >
            {translate("resources.notes.forcedCaseName")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-11 px-4 text-body"
            onSelect={() => setTaskCreateOpen(true)}
          >
            {translate("resources.tasks.forcedCaseName")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
