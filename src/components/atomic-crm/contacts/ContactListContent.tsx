import difference from "lodash/difference";
import union from "lodash/union";
import {
  type Identifier,
  RecordContextProvider,
  RecordRepresentation,
  useListContext,
  useLocaleState,
  useTimeout,
  useTranslate,
} from "ra-core";
import { type MouseEvent, useCallback, useRef } from "react";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

import { Status } from "../misc/Status";
import { formatRelativeDate } from "../misc/RelativeDate";
import { OwnerChipField } from "../sales/SaleAvatar";
import type { Contact } from "../types";
import { Avatar } from "./Avatar";
import { TagsList } from "./TagsList";

export const ContactListContent = () => {
  const translate = useTranslate();
  const {
    data: contacts,
    error,
    isPending,
    onToggleItem,
    onSelect,
    selectedIds,
  } = useListContext<Contact>();
  const lastSelected = useRef<Identifier | null>(null);

  // Handle shift+click to select a range of rows
  const handleToggleItem = useCallback(
    (id: Identifier, event: MouseEvent) => {
      if (!contacts) return;

      const ids = contacts.map((contact) => contact.id);
      const lastSelectedIndex = lastSelected.current
        ? ids.indexOf(lastSelected.current)
        : -1;

      if (event.shiftKey && lastSelectedIndex !== -1) {
        const index = ids.indexOf(id);
        const idsBetweenSelections = ids.slice(
          Math.min(lastSelectedIndex, index),
          Math.max(lastSelectedIndex, index) + 1,
        );

        const isClickedItemSelected = selectedIds?.includes(id);
        const newSelectedIds = isClickedItemSelected
          ? difference(selectedIds, idsBetweenSelections)
          : union(selectedIds, idsBetweenSelections);

        onSelect?.(newSelectedIds);
      } else {
        onToggleItem(id);
      }

      lastSelected.current = id;
    },
    [contacts, selectedIds, onSelect, onToggleItem],
  );

  if (isPending) {
    return (
      <div className="md:divide-y">
        {[...Array(5)].map((_, index) => (
          <div
            key={index}
            className="flex flex-row items-center gap-4 pl-2 pr-4 py-2"
          >
            <div className="px-4 py-3">
              <Skeleton className="h-4 w-4 rounded-sm" />
            </div>
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return null;
  }

  return (
    <div className="md:divide-y">
      {contacts.map((contact) => (
        <RecordContextProvider key={contact.id} value={contact}>
          <ContactItemContent
            contact={contact}
            handleToggleItem={handleToggleItem}
          />
        </RecordContextProvider>
      ))}

      {contacts.length === 0 && (
        <div className="p-4">
          <div className="text-muted-foreground">
            {translate("resources.contacts.empty.title", {})}
          </div>
        </div>
      )}
    </div>
  );
};

const ContactItemContent = ({
  contact,
  handleToggleItem,
}: {
  contact: Contact;
  handleToggleItem: (id: Identifier, event: MouseEvent) => void;
}) => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { selectedIds } = useListContext<Contact>();
  const isSelected = selectedIds.includes(contact.id);
  const lastActivity = contact.last_seen
    ? formatRelativeDate(contact.last_seen, locale)
    : null;

  // Two lines per row instead of three, and the words "laatste activiteit" no
  // longer repeat on every single row: the column position says what the date
  // means.
  return (
    <div
      className={cn(
        "flex flex-row items-center gap-2 pl-2 pr-3 transition-colors duration-1",
        isSelected ? "bg-accent-quiet" : "hover:bg-sunken",
      )}
    >
      <div
        className="flex cursor-pointer items-center px-2 py-3"
        onClick={(e) => handleToggleItem(contact.id, e)}
      >
        <Checkbox
          className="cursor-pointer"
          checked={selectedIds.includes(contact.id)}
          aria-label={`${contact.first_name} ${contact.last_name ?? ""}`}
        />
      </div>
      <Link
        to={`/contacts/${contact.id}/show`}
        className="flex min-w-0 flex-1 flex-row items-center gap-3 rounded-md py-2 no-underline focus-visible:outline-none"
      >
        <Avatar width={32} height={32} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-body font-semibold text-ink">
              {`${contact.first_name} ${contact.last_name ?? ""}`}
            </span>
            <TagsList />
          </div>
          {contact.title || contact.company_id != null || contact.nb_tasks ? (
            <div className="flex min-w-0 items-center gap-1.5 text-meta text-ink-3">
              <span className="min-w-0 truncate">
                {contact.title && contact.company_id != null
                  ? `${translate("resources.contacts.position_at", {
                      title: contact.title,
                    })} `
                  : contact.title}
                {contact.company_id != null && (
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link={false}
                  >
                    <TextField source="name" />
                  </ReferenceField>
                )}
              </span>
              {contact.nb_tasks ? (
                <span className="num shrink-0 text-ink-3">
                  ·{" "}
                  {translate("crm.common.task_count", {
                    smart_count: contact.nb_tasks,
                  })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <OwnerChipField
          source="sales_id"
          record={contact}
          size={20}
          className="hidden shrink-0 text-meta text-ink-3 lg:flex"
        />
        {contact.last_seen ? (
          <time
            className="hidden w-28 shrink-0 text-right text-meta text-ink-3 sm:block"
            dateTime={contact.last_seen}
            title={contact.last_seen}
          >
            {lastActivity}
          </time>
        ) : null}
        <Status status={contact.status} className="shrink-0" />
      </Link>
    </div>
  );
};

export const ContactListContentMobile = () => {
  const translate = useTranslate();
  const {
    data: contacts,
    error,
    isPending,
    refetch,
  } = useListContext<Contact>();
  const oneSecondHasPassed = useTimeout(1000);

  if (isPending) {
    if (!oneSecondHasPassed) {
      return null;
    }
    return (
      <>
        {[...Array(5)].map((_, index) => (
          <div
            key={index}
            className="flex flex-row items-center py-2 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <div className="flex flex-row gap-4 items-center mr-4">
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <Skeleton className="w-32 h-5 mb-2" />
              <Skeleton className="w-48 h-4" />
            </div>
          </div>
        ))}
      </>
    );
  }

  if (error && !contacts) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground mb-4">
          {translate("resources.contacts.list.error_loading")}
        </div>
        <div className="text-center mt-2">
          <Button
            onClick={() => {
              refetch();
            }}
          >
            <RotateCcw />
            {translate("crm.common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="md:divide-y">
      {contacts.map((contact) => (
        <RecordContextProvider key={contact.id} value={contact}>
          <ContactItemContentMobile contact={contact} />
        </RecordContextProvider>
      ))}
      {contacts.length === 0 && (
        <div className="p-4">
          <div className="text-muted-foreground">
            {translate("resources.contacts.empty.title")}
          </div>
        </div>
      )}
    </div>
  );
};

const ContactItemContentMobile = ({ contact }: { contact: Contact }) => {
  const translate = useTranslate();
  return (
    <Link
      to={`/contacts/${contact.id}/show`}
      className="flex flex-row gap-4 items-center py-2 px-2 -mx-2 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Avatar />
      <div className="flex flex-col grow justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between">
            <div className="font-medium">
              <RecordRepresentation />
            </div>
            <Status status={contact.status} />
          </div>
          <div className="text-sm text-muted-foreground">
            <div className="flex flex-col gap-1">
              <span>
                {contact.title && contact.company_id != null
                  ? `${translate("resources.contacts.position_at", {
                      title: contact.title,
                    })} `
                  : contact.title}
                {contact.company_id != null && (
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link={false}
                  >
                    <TextField source="name" />
                  </ReferenceField>
                )}
              </span>
              {contact.nb_tasks ? (
                <span>
                  {translate("crm.common.task_count", {
                    smart_count: contact.nb_tasks,
                  })}
                </span>
              ) : null}
              <OwnerChipField
                source="sales_id"
                record={contact}
                size={16}
                className="text-xs text-muted-foreground"
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
