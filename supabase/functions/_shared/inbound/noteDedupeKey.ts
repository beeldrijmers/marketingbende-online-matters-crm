/**
 * De sleutel waarop een notitie wordt ontdubbeld.
 *
 * Mail komt langs twee wegen binnen: de webhook van Resend en de Gmail-sync. Elke
 * weg heeft zijn eigen id, dus hetzelfde bericht kreeg twee verschillende
 * `source_event_id`-waarden en stond twee keer in het dossier. De unieke index
 * deed precies wat hij moest doen; hij kreeg alleen twee verschillende sleutels.
 *
 * De RFC Message-ID is wat beide wegen delen: die zet de verzendende server, en
 * hij blijft gelijk hoe het bericht ook bij ons komt. Ontbreekt hij, dan valt het
 * terug op het provider-id, want dan is dubbel bewaren beter dan niets bewaren.
 *
 * Let op: dit is NIET de sleutel waarmee een inkomend bericht wordt geclaimd in
 * `inbound_email_events`. Die claim hoort per provider te gaan ("heb ik dit
 * Gmail-bericht al opgehaald"), en moet dus het provider-id blijven.
 */

type HeaderInput =
  | Record<string, string | string[] | undefined>
  | { name?: string; key?: string; value?: string }[]
  | null
  | undefined;

const headerValue = (headers: HeaderInput, wanted: string): string => {
  if (!headers) return "";
  const target = wanted.toLowerCase();

  if (Array.isArray(headers)) {
    const match = headers.find(
      (header) => (header?.name ?? header?.key ?? "").toLowerCase() === target,
    );
    return (match?.value ?? "").trim();
  }

  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === target,
  );
  const value = entry?.[1];
  return (Array.isArray(value) ? value.join(" ") : (value ?? "")).trim();
};

/** Een Message-ID zonder punthaken en zonder hoofdletterverschil. */
export const normaliseMessageId = (raw: string): string | null => {
  const inner = raw.trim().replace(/^<+/, "").replace(/>+$/, "").trim();
  // Een Message-ID zonder apenstaartje is geen Message-ID; dan liever het
  // provider-id dan een sleutel die per ongeluk botst.
  return inner.includes("@") ? inner.toLowerCase() : null;
};

export const noteDedupeKey = ({
  emailId,
  headers,
}: {
  emailId: string;
  headers?: HeaderInput;
}): string => {
  const raw =
    headerValue(headers, "message-id") || headerValue(headers, "message_id");
  const normalised = raw ? normaliseMessageId(raw) : null;
  return normalised ? `msg:${normalised}` : emailId;
};
