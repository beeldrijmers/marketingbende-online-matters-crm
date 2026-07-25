import { useTranslate } from "ra-core";

import { MobilePage } from "../layout/MobilePage";
import { PageBody } from "../layout/PageBody";
import { PageHeader } from "../layout/PageHeader";
import { DashboardActivityLog } from "./DashboardActivityLog";

/** What changed, newest first: notes, new deals, new contacts, imports. */
export const UpdatesPage = () => {
  const translate = useTranslate();
  return (
    <>
      <PageHeader
        title={translate("crm.navigation.updates", { _: "Updates" })}
        meta={translate("crm.updates.meta", {
          _: "Alles wat het team recent heeft vastgelegd",
        })}
      />
      <PageBody className="max-w-3xl">
        <DashboardActivityLog />
      </PageBody>
    </>
  );
};

export const MobileUpdatesPage = () => {
  const translate = useTranslate();
  return (
    <MobilePage title={translate("crm.navigation.updates", { _: "Updates" })}>
      <DashboardActivityLog />
    </MobilePage>
  );
};
