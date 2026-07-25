import { useTranslate } from "ra-core";

import { MobilePage } from "../layout/MobilePage";
import { PageHeader } from "../layout/PageHeader";
import { IntegrationStatus } from "./IntegrationStatus";

/** Live status of Gmail, Trello and Moneybird, plus the last full check. */
export const IntegrationsPage = () => {
  const translate = useTranslate();
  return (
    <>
      <PageHeader
        title={translate("crm.navigation.integrations", { _: "Koppelingen" })}
        meta={translate("crm.integrations.meta", {
          _: "Status van Gmail, Trello en Moneybird",
        })}
      />
      <div className="max-w-3xl">
        <IntegrationStatus />
      </div>
    </>
  );
};

export const MobileIntegrationsPage = () => {
  const translate = useTranslate();
  return (
    <MobilePage
      title={translate("crm.navigation.integrations", { _: "Koppelingen" })}
    >
      <IntegrationStatus />
    </MobilePage>
  );
};
