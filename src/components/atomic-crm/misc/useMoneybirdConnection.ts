import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "../providers/types";

// The current user's Moneybird connection status. Shared by the deal document
// buttons (gating) and the profile page (connect/disconnect section); React
// Query dedupes the request across all of them via the query key.
export const MONEYBIRD_CONNECTION_QUERY_KEY = ["moneybird_connection"];

export const useMoneybirdConnection = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  return useQuery({
    queryKey: MONEYBIRD_CONNECTION_QUERY_KEY,
    queryFn: () => dataProvider.getMoneybirdConnection(),
    staleTime: 5 * 60 * 1000,
  });
};
