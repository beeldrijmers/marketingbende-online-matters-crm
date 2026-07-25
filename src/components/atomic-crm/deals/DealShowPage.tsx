import { ArrowLeft } from "lucide-react";
import { ShowBase, useTranslate } from "ra-core";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { PageHeader } from "../layout/PageHeader";
import { BOARD_PATH } from "./dashboardDealSelection";
import { DealShowBody } from "./DealShowBody";

/**
 * The deal detail as a real page, so `/deals/:id/show` is linkable, openable in
 * a new tab and reachable with the browser's back button. Clicking a card still
 * opens the dialog over the board; this is what Cmd-click and pasted links get.
 */
export const DealShowPage = () => {
  const translate = useTranslate();
  return (
    <>
      <PageHeader
        title={translate("resources.deals.forcedCaseName", {
          _: "Opdracht",
        })}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to={BOARD_PATH}>
              <ArrowLeft className="size-4" />
              {translate("resources.deals.name", {
                smart_count: 2,
                _: "Opdrachten",
              })}
            </Link>
          </Button>
        }
      />
      <ShowBase>
        <div className="max-w-6xl">
          <DealShowBody closeTo={BOARD_PATH} />
        </div>
      </ShowBase>
    </>
  );
};
