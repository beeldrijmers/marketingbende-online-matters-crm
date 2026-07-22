import { useGetList, useTranslate } from "ra-core";
import { matchPath, useLocation, Link } from "react-router";
import type { ReactNode } from "react";
import { CreateButton } from "@/components/admin/create-button";
import { Progress } from "@/components/ui/progress";

import useAppBarHeight from "../misc/useAppBarHeight";
import type { Contact } from "../types";
import { DealCreate } from "./DealCreate";

export const DealEmpty = ({
  children,
  createCloseTo,
  createOpen,
  createTo,
}: {
  children?: ReactNode;
  createCloseTo?: string;
  createOpen?: boolean;
  createTo?: string;
}) => {
  const translate = useTranslate();
  const location = useLocation();
  const matchCreate = matchPath("/deals/create", location.pathname);
  const appbarHeight = useAppBarHeight();

  // get Contact data
  const { data: contacts, isPending: contactsLoading } = useGetList<Contact>(
    "contacts",
    {
      pagination: { page: 1, perPage: 1 },
    },
  );

  if (contactsLoading) return <Progress value={50} />;

  return (
    <div
      className="flex flex-col items-center justify-center gap-6 px-4"
      style={{
        height: `calc(100dvh - ${appbarHeight}px)`,
      }}
    >
      <img
        src="./img/empty.svg"
        alt={translate("resources.deals.empty.title")}
        className="h-auto w-56 sm:w-64"
      />
      {contacts && contacts.length > 0 ? (
        <>
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              {translate("resources.deals.empty.title")}
            </h3>
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              {translate("resources.deals.empty.description")}
            </p>
          </div>
          {createTo ? (
            <CreateButtonLink to={createTo} />
          ) : (
            <CreateButton label="resources.deals.action.create" />
          )}
          <DealCreate
            closeTo={createCloseTo}
            open={createOpen ?? !!matchCreate}
          />
          {children}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">
            {translate("resources.deals.empty.title")}
          </h3>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            {translate("resources.contacts.empty.description")}
            <br />
            <Link
              to="/contacts/create"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              {translate("resources.contacts.action.add_first")}
            </Link>{" "}
            {translate("resources.deals.empty.before_create")}
          </p>
        </div>
      )}
    </div>
  );
};

const CreateButtonLink = ({ to }: { to: string }) => {
  const translate = useTranslate();
  return (
    <Link
      to={to}
      className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
    >
      {translate("resources.deals.action.create")}
    </Link>
  );
};
