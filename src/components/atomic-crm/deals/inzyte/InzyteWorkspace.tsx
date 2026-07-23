import type { SyntheticEvent } from "react";
import {
  BarChart3,
  CheckCircle2,
  Link2,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Deal } from "../../types";
import { InzyteWorkspaceContent } from "./InzyteWorkspaceContent";
import {
  getInzyteConnectionSummary,
  getInzyteSourceStates,
} from "./inzyteVerification";
import { useInzyteWorkspaceController } from "./useInzyteWorkspaceController";

const stopCardEvent = (event: SyntheticEvent) => event.stopPropagation();

export const InzyteWorkspace = ({ record }: { record: Deal }) => {
  const controller = useInzyteWorkspaceController(record);
  const displayedLink = controller.bootstrap?.link ?? record.inzyte_link;
  const connection = getInzyteConnectionSummary(displayedLink);

  return (
    <Dialog open={controller.open} onOpenChange={controller.setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 text-[11px]"
          onClick={stopCardEvent}
          onPointerDown={stopCardEvent}
        >
          <BarChart3 className="size-3.5 text-sky-500" />
          {connection.tone === "success"
            ? "Open"
            : record.inzyte_link
              ? "Controleren"
              : "Instellen"}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-none grid-cols-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        onClick={stopCardEvent}
        onPointerDown={stopCardEvent}
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14">
          <div className="flex flex-wrap items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-500">
              <BarChart3 className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-xl">
                Klantinzichten · {record.name}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Maak een klantupdate, PDF-rapport of verdiepende analyse met de
                live gecontroleerde klantgegevens.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 pr-4">
              {connection.tone === "success" ? (
                <Badge className="gap-1 bg-emerald-600 text-white">
                  <CheckCircle2 className="size-3.5" /> {connection.label}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={cn(
                    connection.tone === "error"
                      ? "border-rose-500/40 text-rose-600"
                      : "border-amber-500/40 text-amber-600",
                  )}
                >
                  <Link2 className="size-3.5" /> {connection.label}
                </Badge>
              )}
              {controller.bootstrap?.link?.last_error ? (
                <Badge variant="destructive">Koppeling vraagt aandacht</Badge>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        {controller.loadingBootstrap && !controller.bootstrap ? (
          <div className="grid flex-1 place-items-center">
            <div className="text-center">
              <Loader2 className="mx-auto size-8 animate-spin text-sky-500" />
              <p className="mt-3 text-sm text-muted-foreground">
                Klantkoppelingen en historie laden…
              </p>
            </div>
          </div>
        ) : controller.bootstrap ? (
          <InzyteWorkspaceContent record={record} controller={controller} />
        ) : (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <p className="text-sm text-muted-foreground">
                De klantinzichten konden niet worden geladen.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={controller.loadBootstrap}
              >
                <RefreshCw className="size-4" /> Opnieuw proberen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const InzyteCardActions = ({ record }: { record: Deal }) => {
  const connection = getInzyteConnectionSummary(record.inzyte_link);
  const sources = getInzyteSourceStates(record.inzyte_link);

  return (
    <div
      role="presentation"
      className="mt-1 grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 border-t pt-1.5"
      onClick={stopCardEvent}
      onPointerDown={stopCardEvent}
      onKeyDown={stopCardEvent}
    >
      <div className="min-w-0">
        <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
          <BarChart3 className="size-3.5 text-sky-500" />
          Klantinzichten
          <span
            className={cn(
              "ml-0.5",
              connection.tone === "error"
                ? "text-rose-600"
                : connection.tone === "success"
                  ? "text-emerald-600"
                  : "text-amber-600",
            )}
          >
            · {connection.label.toLowerCase()}
          </span>
        </span>
        {record.inzyte_link ? (
          <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[9px] font-medium uppercase tracking-wide">
            {sources.map((source) => (
              <span
                key={source.key}
                className={
                  source.verified
                    ? "text-emerald-600"
                    : source.configured
                      ? "text-amber-600"
                      : "text-muted-foreground/45"
                }
              >
                {source.shortLabel}{" "}
                {source.verified ? "✓" : source.configured ? "?" : "—"}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <InzyteWorkspace record={record} />
    </div>
  );
};
