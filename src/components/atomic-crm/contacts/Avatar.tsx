import {
  AvatarFallback,
  AvatarImage,
  Avatar as ShadcnAvatar,
} from "@/components/ui/avatar";
import { useRecordContext } from "ra-core";

import type { Contact } from "../types";

/** 20 in dense rows, 25 in pickers, 32 in lists, 40 on detail pages. */
const SIZE_CLASS = {
  20: "size-5",
  25: "size-[25px]",
  32: "size-8",
  40: "size-10",
} as const;

export const Avatar = (props: {
  record?: Contact;
  width?: keyof typeof SIZE_CLASS;
  height?: keyof typeof SIZE_CLASS;
  title?: string;
}) => {
  const record = useRecordContext<Contact>(props);
  // If we come from company page, the record is defined (to pass the company as a prop),
  // but neither of those fields are and this lead to an error when creating contact.
  if (!record?.avatar && !record?.first_name && !record?.last_name) {
    return null;
  }

  const size = props.width ?? props.height ?? 40;

  return (
    <ShadcnAvatar
      className={`${SIZE_CLASS[size]} shrink-0`}
      title={props.title}
    >
      <AvatarImage src={record.avatar?.src ?? undefined} />
      <AvatarFallback
        className={size < 40 ? "text-eyebrow tracking-normal" : "text-body"}
      >
        {record.first_name?.charAt(0).toUpperCase()}
        {record.last_name?.charAt(0).toUpperCase()}
      </AvatarFallback>
    </ShadcnAvatar>
  );
};
