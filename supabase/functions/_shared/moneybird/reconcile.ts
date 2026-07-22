import { documentReference } from "./payload.ts";
import type { DocumentKind, MoneybirdDocument } from "./types.ts";

const STOP_WORDS = new Set([
  "aan",
  "afgerond",
  "akkoord",
  "de",
  "een",
  "en",
  "factuur",
  "feedback",
  "het",
  "in",
  "klaar",
  "klant",
  "laatste",
  "met",
  "op",
  "opdracht",
  "te",
  "van",
  "voor",
  "wacht",
]);

const words = (value: string): Set<string> =>
  new Set(
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word)),
  );

const overlapScore = (left: Set<string>, right: Set<string>): number => {
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  left.forEach((word) => {
    if (right.has(word)) overlap += 1;
  });
  return overlap / Math.min(left.size, right.size);
};

const amountMatches = (
  document: MoneybirdDocument,
  amount: number | null,
): boolean => {
  if (!amount || amount <= 0) return false;
  const documentAmount = Number(document.total_price_excl_tax);
  return (
    Number.isFinite(documentAmount) && Math.abs(documentAmount - amount) < 0.01
  );
};

export type MoneybirdMatch = {
  document: MoneybirdDocument;
  confidence: "exact_reference" | "strong" | "possible";
  score: number;
  reasons: string[];
};

export const rankMoneybirdDocuments = ({
  kind,
  dealId,
  dealName,
  dealDescription,
  amount,
  contactId,
  documents,
}: {
  kind: DocumentKind;
  dealId: number;
  dealName: string;
  dealDescription?: string | null;
  amount: number | null;
  contactId: string;
  documents: MoneybirdDocument[];
}): MoneybirdMatch[] => {
  const reference = documentReference(kind, dealId);
  const dealWords = words(`${dealName} ${dealDescription || ""}`);
  return documents
    .flatMap((document) => {
      if (document.contact_id !== contactId) return [];
      const reasons: string[] = ["Zelfde bedrijf in Moneybird"];
      let score = 1;
      if (document.reference === reference) {
        score += 1_000;
        reasons.push("Exacte CRM-referentie");
      }
      if (amountMatches(document, amount)) {
        score += 100;
        reasons.push("Bedrag komt exact overeen");
      }
      const documentWords = words(
        (document.details || [])
          .map((detail) => detail.description || "")
          .join(" "),
      );
      const overlap = overlapScore(dealWords, documentWords);
      if (overlap > 0) {
        score += Math.round(overlap * 100);
        reasons.push("Omschrijving komt overeen");
      }
      const match = {
        document,
        score,
        reasons,
        confidence:
          document.reference === reference
            ? ("exact_reference" as const)
            : score >= 125
              ? ("strong" as const)
              : ("possible" as const),
      };
      return score > 0 ? [match] : [];
    })
    .sort((left, right) => right.score - left.score);
};

export const autoReconcileMatch = (
  matches: MoneybirdMatch[],
): MoneybirdMatch | null => {
  const exact = matches.find((match) => match.confidence === "exact_reference");
  if (exact) return exact;
  const strong = matches.filter((match) => match.confidence === "strong");
  // A legacy document without our CRM reference is only adopted when there is
  // one unambiguous strong candidate. Ambiguous matches remain visible for a
  // deliberate manual choice; this avoids attaching the wrong real invoice.
  return strong.length === 1 ? strong[0] : null;
};
