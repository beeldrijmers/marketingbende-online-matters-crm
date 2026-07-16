export type ActivityAttribution = {
  source?: string | null;
  sourceAuthor?: string | null;
};

export type ExternalActivityAttribution = {
  source: "trello";
  sourceAuthor: string | null;
};

/**
 * Returns an external attribution only for sources that must never be
 * presented as the signed-in CRM user. A Trello sync stores a technical CRM
 * owner for access control, but the actual author lives in Trello.
 */
export const getExternalActivityAttribution = ({
  source,
  sourceAuthor,
}: ActivityAttribution): ExternalActivityAttribution | null => {
  if (source !== "trello") return null;

  const trimmedAuthor = sourceAuthor?.trim();
  return {
    source,
    sourceAuthor: trimmedAuthor || null,
  };
};
