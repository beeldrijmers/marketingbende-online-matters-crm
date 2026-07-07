import { CreateButton } from "@/components/admin/create-button";
import { useTranslate } from "ra-core";

import { useIsMobile } from "@/hooks/use-mobile";
import useAppBarHeight from "../misc/useAppBarHeight";

export const CompanyEmpty = () => {
  const appbarHeight = useAppBarHeight();
  const translate = useTranslate();
  const isMobile = useIsMobile();
  return (
    <div
      className="flex flex-col justify-center items-center gap-6 px-4"
      style={{
        height: `calc(100dvh - ${appbarHeight}px)`,
      }}
    >
      <img
        src="./img/empty.svg"
        alt={translate("resources.companies.empty.title", {
          _: "No companies found",
        })}
        className="h-auto w-56 sm:w-64"
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
      {/* MobileAdmin has no companies-create route (creation is desktop-only,
          matching the mobile create menu which omits companies), so the button
          would be a dead end on phones. */}
      {!isMobile && <CreateButton label="resources.companies.action.create" />}
    </div>
  );
};
