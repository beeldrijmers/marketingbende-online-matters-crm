import { Navigate, matchPath, useLocation } from "react-router";

import {
  DASHBOARD_WORKBOARD_PATH,
  getDashboardDealCreatePath,
  getDashboardDealDetailPath,
  getDashboardDealEditPath,
  getDashboardDealReturnPath,
} from "./dashboardDealSelection";

/**
 * Keeps historic assignment URLs useful while the Dashboard is the single
 * operational workspace. Existing bookmarks land on the matching dashboard
 * dialog instead of a removed standalone page.
 */
export const getDealDashboardRedirectPath = (
  pathname: string,
  search: string,
  basePath = DASHBOARD_WORKBOARD_PATH,
) => {
  const returnPath = getDashboardDealReturnPath(basePath, search);
  const translateHistoricDetail = basePath === DASHBOARD_WORKBOARD_PATH;
  const createMatch = translateHistoricDetail
    ? matchPath("/deals/create", pathname)
    : null;
  const showMatch = translateHistoricDetail
    ? matchPath("/deals/:id/show", pathname)
    : null;
  const editMatch = translateHistoricDetail
    ? matchPath("/deals/:id", pathname)
    : null;

  return createMatch
    ? getDashboardDealCreatePath(returnPath)
    : showMatch?.params.id
      ? getDashboardDealDetailPath(returnPath, showMatch.params.id)
      : editMatch?.params.id
        ? getDashboardDealEditPath(returnPath, editMatch.params.id)
        : returnPath;
};

export const DealDashboardRedirect = ({
  basePath = DASHBOARD_WORKBOARD_PATH,
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
