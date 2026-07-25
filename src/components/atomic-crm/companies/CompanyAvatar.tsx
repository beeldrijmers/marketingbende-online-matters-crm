import { useRecordContext } from "ra-core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { Company } from "../types";

/** The three sizes in use: 16 on board cards, 20 in lists, 40 on detail pages. */
const SIZE_CLASS = {
  16: "size-4",
  20: "size-5",
  40: "size-10",
} as const;

export const CompanyAvatar = (props: {
  record?: Company;
  width?: keyof typeof SIZE_CLASS;
  height?: keyof typeof SIZE_CLASS;
}) => {
  const { width = 40 } = props;
  const record = useRecordContext<Company>(props);
  if (!record) return null;

  return (
    <Avatar className={SIZE_CLASS[width]}>
      <AvatarImage
        src={record.logo?.src}
        alt={record.name}
        className="object-contain"
      />
      <AvatarFallback
        className={width === 40 ? "text-body" : "text-eyebrow tracking-normal"}
      >
        {record.name.charAt(0)}
      </AvatarFallback>
    </Avatar>
  );
};
