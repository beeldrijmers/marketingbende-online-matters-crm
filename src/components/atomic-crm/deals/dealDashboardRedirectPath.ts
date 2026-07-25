import { matchPath } from "react-router";

import {
  BOARD_PATH,
  getDashboardDealCreatePath,
  getDashboardDealDetailPath,
  getDashboardDealEditPath,
  getDashboardDealReturnPath,
} from "./dashboardDealSelection";

export const getDealDashboardRedirectPath = (
  pathname: string,
  search: string,
  basePath = BOARD_PATH,
) => {
  const returnPath = getDashboardDealReturnPath(basePath, search);
  const translateHistoricDetail = basePath === BOARD_PATH;
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
