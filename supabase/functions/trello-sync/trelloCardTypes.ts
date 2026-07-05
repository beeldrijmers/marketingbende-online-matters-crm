export interface TrelloCardInput {
  id: string;
  name: string;
  idList: string;
  labelNames: string[];
  due: string | null;
  dueComplete: boolean;
  url: string;
  // The card's markdown description — used to enrich the deal description and
  // to look for a client website (for the company logo).
  desc: string;
  // URLs of the card's attachments — often the client's website, used as a
  // source for the company website/logo.
  attachmentUrls: string[];
}
