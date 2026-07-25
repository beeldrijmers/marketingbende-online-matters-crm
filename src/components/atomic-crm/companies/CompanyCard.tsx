import { Link } from "react-router";
import { useCreatePath, useRecordContext, useTranslate } from "ra-core";

import { Avatar as ContactAvatar } from "../contacts/Avatar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Contact } from "../types";
import { CompanyAvatar } from "./CompanyAvatar";

/**
 * A client tile: identity on top, weight at the bottom.
 *
 * The old card centred everything in a fixed 200px box, which clipped both long
 * company names and the deal label ("1 Opdra…"). Left-aligned text can wrap, and
 * the deal count is a plain number next to its noun.
 */
export const CompanyCard = (props: {
  record?: Company;
  contacts?: Contact[];
}) => {
  const createPath = useCreatePath();
  const record = useRecordContext<Company>(props);
  const translate = useTranslate();
  const { companySectors } = useConfigurationContext();
  if (!record) return null;

  const contacts = props.contacts ?? [];
  const sectorLabel = companySectors.find(
    (sector) => sector.value === record.sector,
  )?.label;

  return (
    <Link
      to={createPath({ resource: "companies", id: record.id, type: "show" })}
      className="panel group flex min-h-[8.5rem] flex-col justify-between gap-3 p-3 no-underline transition-[background-color,border-color,box-shadow] duration-1 hover:border-line-strong hover:bg-raised-hi hover:shadow-e2 focus-visible:outline-none"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <CompanyAvatar width={40} height={40} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-body font-semibold leading-5 text-ink">
            {record.name}
          </h3>
          {sectorLabel ? (
            <p className="mt-0.5 line-clamp-1 text-meta text-ink-3">
              {sectorLabel}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2">
        {record.nb_contacts ? (
          <AvatarGroup contacts={contacts} total={record.nb_contacts} />
        ) : (
          <span className="text-meta text-ink-3">
            {translate("resources.companies.no_contacts", {
              _: "Geen contact",
            })}
          </span>
        )}
        {record.nb_deals ? (
          <span className="num shrink-0 text-meta text-ink-2">
            {translate("resources.companies.nb_deals", {
              smart_count: record.nb_deals,
            })}
          </span>
        ) : null}
      </div>
    </Link>
  );
};

const AvatarGroup = ({
  contacts,
  total,
}: {
  contacts: Contact[];
  total: number;
}) => {
  const MAX_AVATARS = 3;
  return (
    <div className="flex -space-x-1 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-raised">
      {contacts.slice(0, MAX_AVATARS).map((record) => (
        <ContactAvatar
          key={record.id}
          record={record}
          width={25}
          height={25}
          title={`${record.first_name} ${record.last_name}`}
        />
      ))}
      {total > MAX_AVATARS && (
        <span
          className="relative flex size-[25px] shrink-0 overflow-hidden rounded-full"
          data-slot="avatar"
        >
          <span className="num flex size-full items-center justify-center rounded-full bg-sunken text-eyebrow tracking-normal text-ink-2">
            +{total - MAX_AVATARS}
          </span>
        </span>
      )}
    </div>
  );
};
