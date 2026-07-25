import { useRecordContext } from "ra-core";
import { ReferenceArrayField } from "@/components/admin/reference-array-field";
import { SingleFieldList } from "@/components/admin/single-field-list";
import { cn } from "@/lib/utils";

/**
 * A tag reads as a coloured dot plus its name.
 *
 * Filling the whole chip with the user-picked pastel and forcing black text
 * (the previous approach) was unreadable in dark mode and shouted louder than
 * the contact's own name. The colour is still the tag's identity — it is just
 * the size of a dot now.
 */
const TagChip = (props: { className?: string }) => {
  const record = useRecordContext<{ color: string; name: string }>();
  if (!record) return null;
  return (
    <span
      className={cn(
        "inline-flex max-w-40 items-center gap-1 rounded-sm bg-sunken px-1.5 py-0.5 text-meta text-ink-2",
        props.className,
      )}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: record.color }}
      />
      <span className="truncate">{record.name}</span>
    </span>
  );
};

export const TagsList = ({ className }: { className?: string }) => (
  <ReferenceArrayField
    className={cn("inline-flex flex-wrap gap-1", className)}
    resource="contacts"
    source="tags"
    reference="tags"
  >
    <SingleFieldList>
      <TagChip />
    </SingleFieldList>
  </ReferenceArrayField>
);
