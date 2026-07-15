import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "../providers/types";

export const GMAIL_CONNECTION_QUERY_KEY = ["gmail_connection"];

export const useGmailConnection = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  return useQuery({
    queryKey: GMAIL_CONNECTION_QUERY_KEY,
    queryFn: () => dataProvider.getGmailConnection(),
    staleTime: 60_000,
  });
};
