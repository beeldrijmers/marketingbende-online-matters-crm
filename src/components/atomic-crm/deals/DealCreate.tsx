import { useQueryClient } from "@tanstack/react-query";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useRedirect,
  useTranslate,
  type GetListResult,
} from "ra-core";
import { Create } from "@/components/admin/create";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar } from "@/components/admin/simple-form";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import type { Deal } from "../types";
import { DealInputs } from "./DealInputs";

export const DealCreate = ({
  closeTo = "/deals",
  open,
}: {
  closeTo?: string;
  open: boolean;
}) => {
  const redirect = useRedirect();
  const dataProvider = useDataProvider();
  const translate = useTranslate();

  const handleClose = () => {
    redirect(closeTo);
  };

  const queryClient = useQueryClient();

  const onSuccess = async (deal: Deal) => {
    // The new deal takes index 0, so every other deal in its column must
    // shift one position down. Fetch the full column from the server: the
    // list context may be filtered, and reindexing only the visible deals
    // would leave hidden ones with duplicate indexes (same pattern as
    // updateDealStage in DealListContent).
    const { data: columnDeals } = await dataProvider.getList<Deal>("deals", {
      sort: { field: "index", order: "ASC" },
      pagination: { page: 1, perPage: 1000 },
      filter: { stage: deal.stage },
    });
    const dealsToShift = columnDeals.filter((d) => d.id !== deal.id);
    // update the actual deals in the database
    await Promise.all(
      dealsToShift.map(async (oldDeal) =>
        dataProvider.update("deals", {
          id: oldDeal.id,
          data: { index: oldDeal.index + 1 },
          previousData: oldDeal,
        }),
      ),
    );
    // refresh the list of deals in the cache as we used dataProvider.update(),
    // which does not update the cache
    const dealsById: { [key: string]: Deal } = {};
    for (const existingDeal of dealsToShift) {
      dealsById[existingDeal.id] = {
        ...existingDeal,
        index: existingDeal.index + 1,
      };
    }
    const now = Date.now();
    queryClient.setQueriesData<GetListResult | undefined>(
      { queryKey: ["deals", "getList"] },
      (res) => {
        if (!res) return res;
        return {
          ...res,
          data: res.data.map((d: Deal) => dealsById[d.id] || d),
        };
      },
      { updatedAt: now },
    );
    redirect(closeTo);
  };

  const { identity } = useGetIdentity();

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0"
      >
        {/* Screen readers need an accessible dialog name; the visible form
            has no heading, so the title is visually hidden. */}
        <DialogTitle className="sr-only">
          {translate("resources.deals.action.create")}
        </DialogTitle>
        <Create resource="deals" mutationOptions={{ onSuccess }}>
          <Form
            defaultValues={{
              sales_id: identity?.id,
              // Assign the creator by default so they can see the card they
              // just made; they can add more assignees in the form.
              assignee_ids: identity?.id ? [identity.id] : [],
              contact_ids: [],
              index: 0,
            }}
          >
            <DealInputs />
            <FormToolbar>
              <SaveButton />
            </FormToolbar>
          </Form>
        </Create>
      </DialogContent>
    </Dialog>
  );
};
