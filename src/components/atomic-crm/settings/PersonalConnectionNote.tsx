import { Lock } from "lucide-react";
import { useGetIdentity, useTranslate } from "ra-core";

/**
 * Says out loud what the database already enforces: a connection belongs to one
 * account. Both tables are keyed on sales_id with owner-only row level security
 * and server-side-only tokens, but nothing in the interface said so, which left
 * people wondering whose mailbox or administration the CRM was really using.
 */
export const PersonalConnectionNote = () => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();

  return (
    <p className="flex items-start gap-1.5 text-meta text-ink-3">
      <Lock className="mt-0.5 size-3 shrink-0" />
      <span>
        {translate("crm.profile.personal_connection", {
          name: identity?.fullName ?? "",
          _: `Alleen op dit account (${identity?.fullName ?? "u"}). Collega's koppelen hun eigen account; niemand kan deze koppeling zien of gebruiken.`,
        })}
      </span>
    </p>
  );
};
