import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
} from "lucide-react";

import { Markdown } from "@/components/atomic-crm/misc/Markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { unwrapInzyteData } from "./inzyteData";
import {
  buildInzytePresentation,
  formatInzyteScalar,
  humanizeInzyteField,
  type InzytePresentationTable,
} from "./inzytePresentation";

const KpiGrid = ({
  metrics,
}: {
  metrics: ReturnType<typeof buildInzytePresentation>["metrics"];
}) => (
  <section>
    <div className="mb-3 flex items-center gap-2">
      <h3 className="text-base font-semibold">Kerncijfers</h3>
      <span className="text-xs text-muted-foreground">
        vergeleken met de vorige periode
      </span>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
      {metrics.map((metric) => (
        <div
          key={metric.key}
          className="rounded-xl border bg-card p-4 shadow-sm"
        >
          <div className="text-xs font-medium text-muted-foreground">
            {metric.label}
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            {formatInzyteScalar(metric.value, metric.key)}
          </div>
          {metric.delta !== null ? (
            <div
              className={
                metric.delta >= 0
                  ? "mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600"
                  : "mt-2 flex items-center gap-1 text-xs font-medium text-rose-600"
              }
            >
              {metric.delta >= 0 ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownRight className="size-3.5" />
              )}
              {metric.delta > 0 ? "+" : ""}
              {metric.delta.toLocaleString("nl-NL")}%
            </div>
          ) : null}
        </div>
      ))}
    </div>
  </section>
);

const ResultTable = ({ table }: { table: InzytePresentationTable }) => (
  <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
      <h3 className="font-semibold">{table.title}</h3>
      <Badge variant="secondary">
        {table.rows.length}{" "}
        {table.rows.length === 1 ? "resultaat" : "resultaten"}
      </Badge>
    </div>
    <div className="max-h-[440px] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            {table.columns.map((column) => (
              <TableHead key={column}>{humanizeInzyteField(column)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.slice(0, 100).map((row, index) => (
            <TableRow key={`${table.key}-${index}`}>
              {table.columns.map((column) => (
                <TableCell key={column} className="max-w-96 align-top">
                  <span className="line-clamp-3 break-words">
                    {formatInzyteScalar(row[column], column)}
                  </span>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </section>
);

export const InzyteDataView = ({ data }: { data: unknown }) => {
  const [showRaw, setShowRaw] = useState(false);
  const unwrapped = unwrapInzyteData(data);
  const presentation = buildInzytePresentation(data);
  const hasPresentation = Boolean(
    presentation.metrics.length ||
      presentation.narratives.length ||
      presentation.scalars.length ||
      presentation.tables.length,
  );

  if (unwrapped === null || unwrapped === undefined) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Er is nog geen resultaat voor dit onderdeel.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {presentation.metrics.length > 0 ? (
        <KpiGrid metrics={presentation.metrics} />
      ) : null}

      {presentation.narratives.map((narrative) => (
        <section
          key={`${narrative.title}-${narrative.text.slice(0, 80)}`}
          className="overflow-hidden rounded-xl border border-sky-500/20 bg-linear-to-br from-sky-500/[0.08] to-card shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-sky-500/15 px-5 py-3">
            <FileText className="size-4 text-sky-500" />
            <h3 className="font-semibold">{narrative.title}</h3>
          </div>
          <Markdown className="px-5 py-4 text-sm leading-6">
            {narrative.text}
          </Markdown>
        </section>
      ))}

      {presentation.scalars.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {presentation.scalars.map((item) => (
            <div key={item.key} className="rounded-xl border bg-card p-4">
              <div className="text-xs font-medium text-muted-foreground">
                {item.label}
              </div>
              <div className="mt-1 break-words font-semibold">
                {formatInzyteScalar(item.value, item.key)}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {presentation.tables.map((table) => (
        <ResultTable key={table.key} table={table} />
      ))}

      {!hasPresentation ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Inzyte heeft gegevens teruggegeven, maar geen klantgerichte resultaten
          die hier betrouwbaar kunnen worden samengevat.
        </div>
      ) : null}

      <div className="rounded-xl border bg-muted/20">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          onClick={() => setShowRaw((value) => !value)}
        >
          {showRaw ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          <Database className="size-4" /> Technische brondata
        </Button>
        {showRaw ? (
          <pre className="max-h-[480px] overflow-auto border-t p-4 text-xs leading-5">
            {JSON.stringify(unwrapped, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
};
