export interface TrelloCardInput {
  id: string;
  name: string;
  idList: string;
  labelNames: string[];
  due: string | null;
  dueComplete: boolean;
  url: string;
}
