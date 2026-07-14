import { useRecordContext, useTranslate } from "ra-core";

import { CopyPaste, GmailComposeButton } from "../misc/CopyPaste";
import type { Deal } from "../types";
import { buildDealInboundEmail } from "./dealUtils";

export const DealInboundEmail = () => {
  const translate = useTranslate();
  const record = useRecordContext<Deal>();
  if (!record) return null;

  const inboundEmail = buildDealInboundEmail(
    record.id,
    import.meta.env.VITE_INBOUND_EMAIL,
  );
  if (!inboundEmail) return null;

  return (
    <div className="space-y-2">
      <span className="text-xs text-muted-foreground tracking-wide">
        {translate("resources.deals.inbound.title")}
      </span>
      <p className="text-sm text-muted-foreground">
        {translate("resources.deals.inbound.description")}
      </p>
      <div className="space-y-2">
        <CopyPaste value={inboundEmail} />
        <GmailComposeButton bcc={inboundEmail} />
      </div>
    </div>
  );
};
