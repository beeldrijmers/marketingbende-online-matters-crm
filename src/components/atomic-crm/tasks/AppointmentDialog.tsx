import { CalendarPlus, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { convertDateToString } from "@/components/admin/date-time-input";

import type { CrmDataProvider } from "../providers/types";
import type { Task } from "../types";

const DURATIONS = [15, 30, 45, 60, 90, 120];
const DEFAULT_DURATION = 60;

/** A datetime-local value for the next round half hour, in the local timezone. */
const nextHalfHour = (): string => {
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMinutes(now.getMinutes() > 30 ? 60 : 30);
  return convertDateToString(now);
};

/**
 * De duur zoals hij is opgeslagen, want de dialoog stuurt alleen een duur mee.
 * Zonder dit werd elke afspraak van een kwartier of van twee uur bij het
 * bijwerken stil een uur, omdat het veld op de standaardwaarde stond.
 */
const storedDurationMinutes = (task: Task): number => {
  if (!task.starts_at || !task.ends_at) return DEFAULT_DURATION;
  const minutes = Math.round(
    (new Date(task.ends_at).getTime() - new Date(task.starts_at).getTime()) /
      60_000,
  );
  return minutes > 0 ? minutes : DEFAULT_DURATION;
};

/**
 * Turning a task into an appointment in the owner's own Google Calendar.
 *
 * The CRM used to hold a date and the calendar held the actual moment, so
 * "donderdag om tien uur" lived in two places and only one of them rang. The
 * calendar is now the one that rings, and the task keeps the link to it.
 *
 * Inviting the client is off by default and says out loud what it does: adding a
 * guest makes Google send them a mail, and that is a decision, not a checkbox to
 * discover afterwards.
 */
export const AppointmentDialog = ({
  clientEmail,
  onOpenChange,
  open,
  task,
}: {
  clientEmail?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  task: Task;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();
  // Het veld toont een wandklok zonder zone, dus die moet uit de LOKALE
  // componenten komen. Met toISOString() stond hier UTC, en omdat het opslaan
  // die string wel als lokale tijd terugleest schoof elke bijwerking de
  // afspraak een of twee uur op in de echte agenda.
  const [startsAt, setStartsAt] = useState(() =>
    task.starts_at
      ? convertDateToString(new Date(task.starts_at))
      : nextHalfHour(),
  );
  const [durationMinutes, setDurationMinutes] = useState(() =>
    storedDurationMinutes(task),
  );
  const [inviteClient, setInviteClient] = useState(false);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);

  const planned = Boolean(task.calendar_event_id);

  const plan = async () => {
    setBusy("save");
    try {
      const result = await dataProvider.planAppointment({
        durationMinutes,
        inviteClient,
        inviteEmail: inviteClient ? clientEmail : undefined,
        // datetime-local has no zone; it is the wall clock the user typed, so it
        // is read in their own timezone before being sent as an instant.
        startsAt: new Date(startsAt).toISOString(),
        taskId: task.id,
      });
      notify(
        result.invited
          ? "Afspraak staat in je agenda en de klant heeft een uitnodiging gekregen"
          : "Afspraak staat in je agenda",
        { type: "success" },
      );
      refresh();
      onOpenChange(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Inplannen mislukt", {
        autoHideDuration: 12_000,
        type: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("remove");
    try {
      await dataProvider.removeAppointment(task.id);
      notify("Afspraak uit je agenda gehaald", { type: "info" });
      refresh();
      onOpenChange(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Verwijderen mislukt", {
        autoHideDuration: 12_000,
        type: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {planned ? "Afspraak aanpassen" : "Zet in je agenda"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-meta text-ink-3">{task.text}</p>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow text-ink-3">Wanneer</span>
            <input
              className="h-9 rounded-md border border-line bg-sunken px-3 text-body text-ink"
              onChange={(event) => setStartsAt(event.target.value)}
              type="datetime-local"
              value={startsAt}
            />
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="eyebrow text-ink-3">Hoe lang</legend>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((minutes) => (
                <Button
                  aria-pressed={durationMinutes === minutes}
                  key={minutes}
                  onClick={() => setDurationMinutes(minutes)}
                  size="sm"
                  type="button"
                  variant={durationMinutes === minutes ? "default" : "outline"}
                >
                  {minutes < 60
                    ? `${minutes} min`
                    : `${(minutes / 60).toLocaleString("nl-NL")} uur`}
                </Button>
              ))}
            </div>
          </fieldset>

          {clientEmail ? (
            <label className="flex items-start gap-3 rounded-md border border-line bg-sunken p-3">
              <Switch
                checked={inviteClient}
                onCheckedChange={setInviteClient}
                aria-label="Klant uitnodigen"
              />
              <span className="text-meta text-ink-2">
                Klant uitnodigen
                <span className="mt-0.5 block text-ink-3">
                  {inviteClient
                    ? `${clientEmail} krijgt een uitnodiging per mail van Google.`
                    : "Staat uit: de afspraak blijft in je eigen agenda."}
                </span>
              </span>
            </label>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {planned ? (
            <Button
              disabled={busy !== null}
              onClick={() => void remove()}
              size="sm"
              type="button"
              variant="outline"
            >
              {busy === "remove" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Uit agenda halen
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {task.calendar_html_link ? (
              <Button asChild size="sm" variant="ghost">
                <a
                  href={task.calendar_html_link}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="size-4" />
                  In agenda openen
                </a>
              </Button>
            ) : null}
            <Button
              disabled={busy !== null || !startsAt}
              onClick={() => void plan()}
              size="sm"
              type="button"
            >
              {busy === "save" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CalendarPlus className="size-4" />
              )}
              {planned ? "Bijwerken" : "Inplannen"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
