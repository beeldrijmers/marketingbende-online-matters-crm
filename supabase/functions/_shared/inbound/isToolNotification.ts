/**
 * Notificatiemail van het gereedschap dat het CRM al synchroniseert.
 *
 * Trello mailt bij elke vermelding en elke opmerking. Die mail zegt niets nieuws
 * (de kaart zelf komt via de sync binnen) en heeft geen klant als afzender, dus
 * viel hij in de terugval die een bedrijfsnaam in de tekst zoekt. Zo werd
 * opdracht 31 een stortplaats: dertig notities, waarvan zesentwintig over andere
 * kaarten gingen, met titels als "Rick Maarssen heeft jou genoemd op de kaart".
 *
 * Zo'n dossier is daarna niet meer te vertrouwen, en dat is erger dan een
 * ontbrekende notitie: je leest de geschiedenis van een klant en krijgt ruis over
 * iemand anders.
 */

const NOTIFICATION_DOMAINS = [
  "trello.com",
  "atlassian.net",
  "atlassian.com",
  "asana.com",
  "monday.com",
  "clickup.com",
  "slack.com",
  "linear.app",
  "notion.so",
  "github.com",
  "gitlab.com",
];

/** Regels die alleen in notificatiemail van een bord voorkomen. */
const NOTIFICATION_SUBJECTS = [
  /nieuwe notificaties op/i,
  /heeft jou genoemd op de kaart/i,
  /heeft een opmerking geplaatst op/i,
  /mentioned you on the card/i,
  /added you to the card/i,
  /commented on the card/i,
  /new notifications on/i,
];

const domainOf = (address: string): string => {
  const at = address.lastIndexOf("@");
  return at === -1
    ? ""
    : address
        .slice(at + 1)
        .toLowerCase()
        .trim();
};

const isNotificationDomain = (domain: string): boolean =>
  NOTIFICATION_DOMAINS.some(
    (known) => domain === known || domain.endsWith(`.${known}`),
  );

/**
 * Of deze mail een notificatie van een samenwerkingsbord is, en dus niet als
 * klantcontact bewaard hoort te worden.
 *
 * Twee ingangen, want doorgestuurde notificaties hebben de afzender niet meer:
 * het domein van de afzender, en anders de vaste formuleringen die alleen
 * bordnotificaties gebruiken.
 */
export const isToolNotification = ({
  senderEmail,
  subject = "",
}: {
  senderEmail?: string | null;
  subject?: string | null;
}): boolean => {
  if (senderEmail && isNotificationDomain(domainOf(senderEmail))) return true;
  const text = (subject ?? "").trim();
  if (!text) return false;
  return NOTIFICATION_SUBJECTS.some((pattern) => pattern.test(text));
};
