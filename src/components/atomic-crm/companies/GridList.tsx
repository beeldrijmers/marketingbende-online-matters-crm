import groupBy from "lodash/groupBy";
import {
  RecordContextProvider,
  useGetList,
  useListContext,
  useTranslate,
} from "ra-core";

import { Skeleton } from "@/components/ui/skeleton";
import type { Company, Contact } from "../types";
import { CompanyCard } from "./CompanyCard";

const times = (nbChildren: number, fn: (key: number) => any) =>
  Array.from({ length: nbChildren }, (_, key) => fn(key));

const LoadingGridList = () => (
  <div
    className="w-full gap-2 grid"
    style={{
      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    }}
  >
    {times(15, (key) => (
      <Skeleton className="h-[200px] w-full rounded-xl" key={key} />
    ))}
  </div>
);

const LoadedGridList = () => {
  const { data, error, isPending } = useListContext<Company>();
  const translate = useTranslate();

  // Batch-fetch the contacts for every visible company in a single query,
  // replacing the per-card ReferenceManyField that fired one request per card
  // (an N+1 that made the page slow). We only render up to 3 avatars per
  // company and take the total from the company's nb_contacts, so the perPage
  // cap only ever affects which few avatars show, never the count.
  const companyIds = data?.map((company) => company.id) ?? [];
  const { data: contacts } = useGetList<Contact>(
    "contacts",
    {
      filter: { "company_id@in": `(${companyIds})` },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "company_id", order: "ASC" },
    },
    { enabled: companyIds.length > 0 },
  );
  const contactsByCompany = groupBy(contacts ?? [], "company_id");

  if (isPending || error) return null;

  return (
    <div
      className="w-full gap-2 grid"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
      }}
    >
      {data.map((record) => (
        <RecordContextProvider key={record.id} value={record}>
          <CompanyCard contacts={contactsByCompany[record.id] ?? []} />
        </RecordContextProvider>
      ))}

      {data.length === 0 && (
        <div className="p-2">
          {translate("resources.companies.empty.title", {
            _: "No companies found",
          })}
        </div>
      )}
    </div>
  );
};

export const ImageList = () => {
  const { isPending } = useListContext();
  return isPending ? <LoadingGridList /> : <LoadedGridList />;
};
