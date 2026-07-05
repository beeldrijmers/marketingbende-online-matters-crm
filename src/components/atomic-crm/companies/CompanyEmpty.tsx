import { CreateButton } from "@/components/admin/create-button";
import { useTranslate } from "ra-core";

import useAppBarHeight from "../misc/useAppBarHeight";

export const CompanyEmpty = () => {
  const appbarHeight = useAppBarHeight();
  const translate = useTranslate();
  return (
    <div
      className="flex flex-col justify-center items-center gap-6"
      style={{
        height: `calc(100dvh - ${appbarHeight}px)`,
      }}
    >
      <img
        src="./img/empty.svg"
        alt={translate("resources.companies.empty.title", {
          _: "No companies found",
        })}
        className="w-56 h-auto"
      />
      <div className="flex flex-col gap-2 items-center">
        <h6 className="text-lg font-semibold text-foreground">
          {translate("resources.companies.empty.title", {
            _: "No companies found",
          })}
        </h6>
        <p className="text-sm text-center text-muted-foreground">
          {translate("resources.companies.empty.description", {
            _: "It seems your company list is empty.",
          })}
        </p>
      </div>
      <CreateButton label="resources.companies.action.create" />
    </div>
  );
};
