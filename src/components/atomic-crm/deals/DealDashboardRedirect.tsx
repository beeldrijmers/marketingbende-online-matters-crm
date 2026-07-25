import { Navigate, useLocation } from "react-router";

import { BOARD_PATH } from "./dashboardDealSelection";
import { getDealDashboardRedirectPath } from "./dealDashboardRedirectPath";

/**
 * Keeps historic assignment URLs useful while the Dashboard is the single
 * operational workspace. Existing bookmarks land on the matching dashboard
 * dialog instead of a removed standalone page.
 */
export const DealDashboardRedirect = ({
  basePath = BOARD_PATH,
}: {
  basePath?: string;
}) => {
  const location = useLocation();
  const target = getDealDashboardRedirectPath(
    location.pathname,
    location.search,
    basePath,
  );

  return <Navigate to={target} replace />;
};
