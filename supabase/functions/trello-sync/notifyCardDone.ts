interface TrelloUpdateAction {
  type: string;
  data?: {
    listBefore?: { id?: string };
    listAfter?: { id?: string };
  };
}

// True only for the transition INTO the "Klaar" list (a genuine list move,
// where the card was somewhere else before). This excludes edits to a card that
// is already in Klaar, so the notification fires exactly once per completion.
export const isMoveToWonList = (
  action: TrelloUpdateAction,
  wonListId: string,
): boolean =>
  action.type === "updateCard" &&
  action.data?.listAfter?.id === wonListId &&
  !!action.data?.listBefore?.id &&
  action.data.listBefore.id !== wonListId;

// Builds the "project afgerond" notification e-mail. Pure so the wording and
// escaping stay under test; the transport lives in sendCardDoneNotification.
export const buildCardDoneEmail = ({
  projectName,
  doneBy,
  cardUrl,
  date,
}: {
  projectName: string;
  doneBy: string;
  cardUrl?: string;
  date: string;
}): { subject: string; text: string } => {
  const lines = [
    `${doneBy} heeft "${projectName}" afgerond (verplaatst naar Klaar) op ${date}.`,
  ];
  if (cardUrl) {
    lines.push("", `Kaart: ${cardUrl}`);
  }
  return {
    subject: `Afgerond: ${projectName}`,
    text: lines.join("\n"),
  };
};

// Whether the card-done notification is configured at all. Checked BEFORE
// claiming the one-shot notification, so an unconfigured environment does not
// burn the claim (the team lead would then never get the e-mail, even after
// the secrets are set).
export const isCardDoneNotificationConfigured = (): boolean =>
  Boolean(
    Deno.env.get("NOTIFY_CARD_DONE_EMAIL") && Deno.env.get("RESEND_API_KEY"),
  );

// Notifies the team lead by e-mail that a project moved to "Klaar". Configured
// via env; entirely inert (logs and returns false) when the recipient or API
// key is missing, so it can be rolled out before the secrets are set.
// Best-effort: a failure here never breaks the Trello sync — it returns false
// so the caller can release the notification claim for a later retry.
export const sendCardDoneNotification = async ({
  projectName,
  doneBy,
  cardUrl,
}: {
  projectName: string;
  doneBy: string;
  cardUrl?: string;
}): Promise<boolean> => {
  const to = Deno.env.get("NOTIFY_CARD_DONE_EMAIL");
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!to || !apiKey) {
    console.warn(
      "Card-done notification skipped: NOTIFY_CARD_DONE_EMAIL or RESEND_API_KEY not set.",
    );
    return false;
  }

  const from =
    Deno.env.get("NOTIFY_FROM_EMAIL") ??
    "Marketingbende CRM <crm@inbound.marketingbende.nl>";
  const date = new Date().toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const { subject, text } = buildCardDoneEmail({
    projectName,
    doneBy,
    cardUrl,
    date,
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}`);
    }
    return true;
  } catch (error) {
    console.error(
      `Could not send card-done notification for "${projectName}":`,
      (error as Error).message,
    );
    return false;
  }
};
