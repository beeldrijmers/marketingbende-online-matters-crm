import type { Identifier } from "ra-core";

import type { Deal, Task } from "../types";
import { isAutomaticTask } from "../tasks/taskSource";

export type DealWorkflowKind =
  | "overdue"
  | "today"
  | "scheduled"
  | "unscheduled"
  | "overdue_closing"
  | "proposal_expired"
  | "stalled"
  | "missing"
  | "on_hold"
  | "complete";

export type DealWorkflow = {
  kind: DealWorkflowKind;
  nextTask: Task | null;
  openTaskCount: number;
  /**
   * De eerstvolgende open taak van werk dat stilstaat, alleen om te tonen.
   *
   * Een opdracht op "wacht op input" hoort niet in de aandachtsrij, en daarvoor
   * werd `nextTask` op null gezet. Daarmee verdween ook de datum, en dus stond
   * op de kaart alleen "wacht" zonder te zeggen of dat deze week is of pas in
   * december. Elf opdrachten stonden zo stil, samen met vijfentwintig verlopen
   * taken die niemand zag. Bewust een eigen veld: `nextTask` blijft leeg, zodat
   * geen enkele bestaande lezer plots wachtend werk als actie behandelt.
   */
  resumeTask: Task | null;
  /**
   * Alleen om te tonen, en alleen gevuld door de soort die erop steunt: het
   * aantal dagen stilstand bij "stalled", de vervaldatum bij een verlopen
   * voorstel. Bewust optioneel, zodat de zeven bestaande uitgangen van
   * getDealWorkflow niet allemaal een leeg veld hoeven mee te dragen.
   */
  daysOnStage?: number | null;
  proposalValidUntil?: string | null;
};

const dayKey = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
};

/** De dag van vandaag als yyyy-MM-dd in de eigen tijdzone, om datums te vergelijken. */
export const localTodayKey = (now: Date): string => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Hoe lang werk op dezelfde stap mag staan voordat het opvalt.
 *
 * Per stap, want de vraag verschilt. Twee weken wachten op akkoord om live te
 * gaan is iets anders dan twee weken aan een website bouwen. Wat er niet in
 * staat, zwijgt bewust: doorlopend werk ("Vaste klanten") staat per definitie
 * lang op dezelfde stap, en werk dat af is hoeft niet te bewegen.
 *
 * De getallen zijn ruim gekozen. Het bord is er niet om alarm te slaan maar om
 * te tonen wat er speelt; een signaal dat elke week bij de helft afgaat leert
 * mensen het te negeren.
 */
export const stageStaleAfterDays: Record<string, number> = {
  "informatie-pipeline": 21,
  "bevestigd-inplannen": 14,
  bezig: 30,
  "controle-livegang": 14,
  "facturatie-live": 10,
  "on-hold": 45,
};

const daysBetween = (from: string, now: Date): number =>
  Math.floor((now.getTime() - new Date(from).getTime()) / 86_400_000);

/** Hoe lang deze opdracht al op dezelfde stap staat, of null als dat niet vaststaat. */
export const daysOnStage = (deal: Deal, now: Date): number | null => {
  const since = deal.stage_since ?? deal.created_at;
  if (!since) return null;
  const days = daysBetween(since, now);
  return Number.isFinite(days) ? days : null;
};

const isStalled = (deal: Deal, now: Date): boolean => {
  const threshold = stageStaleAfterDays[deal.stage];
  if (threshold == null) return false;
  const days = daysOnStage(deal, now);
  return days != null && days >= threshold;
};

/**
 * Een verlopen voorstel telt alleen zolang de opdracht nog niet bevestigd is.
 * Daarna is de geldigheidsdatum een historisch feit en geen openstaande vraag.
 */
const hasExpiredProposal = (deal: Deal, today: string): boolean => {
  if (deal.stage !== "informatie-pipeline") return false;
  const validUntil = dayKey(deal.proposal_valid_until);
  return validUntil != null && validUntil < today;
};

const compareTasks = (left: Task, right: Task): number => {
  const leftDue = dayKey(left.due_date);
  const rightDue = dayKey(right.due_date);
  if (leftDue && rightDue) return leftDue.localeCompare(rightDue);
  if (leftDue) return -1;
  if (rightDue) return 1;
  return String(left.id).localeCompare(String(right.id));
};

export const buildOpenTasksByDeal = (
  tasks: Task[],
): Map<Identifier, Task[]> => {
  const result = new Map<Identifier, Task[]>();

  for (const task of tasks) {
    if (task.done_date || task.deal_id == null) continue;
    const existing = result.get(task.deal_id);
    if (existing) existing.push(task);
    else result.set(task.deal_id, [task]);
  }

  for (const dealTasks of result.values()) {
    dealTasks.sort(compareTasks);
  }

  return result;
};

export const getDealWorkflow = (
  deal: Deal,
  openTasks: Task[] = [],
  now: Date = new Date(),
): DealWorkflow => {
  if (deal.stage === "won") {
    return {
      kind: "complete",
      nextTask: null,
      openTaskCount: 0,
      resumeTask: null,
    };
  }

  // A consciously paused deal should not pollute the attention queue, even if
  // an older open task is still attached to it. It becomes actionable again
  // when the deal is resumed.
  if (deal.on_hold || deal.stage === "on-hold") {
    const waiting = [...openTasks]
      .filter((task) => !task.done_date && !isAutomaticTask(task))
      .sort(compareTasks);
    // Zonder hervatdatum en na anderhalve maand is werk niet meer geparkeerd
    // maar vergeten. Dan is de stilstand zelf het signaal, want er is verder
    // niets dat het ooit terugbrengt.
    if (waiting.length === 0 && isStalled(deal, now)) {
      return {
        kind: "stalled",
        nextTask: null,
        openTaskCount: 0,
        resumeTask: null,
        daysOnStage: daysOnStage(deal, now),
      };
    }
    return {
      kind: "on_hold",
      nextTask: null,
      openTaskCount: waiting.length,
      resumeTask: waiting[0] ?? null,
    };
  }

  // The DB maintains an `auto` row as a fallback while a deal has no concrete
  // next action. Its due date is deliberately operational rather than agreed
  // with a customer, so treat it as missing planning instead of overdue work.
  // Manual tasks and Trello checklist items remain the only task deadlines
  // that can make a deal "Te laat".
  const sortedTasks = [...openTasks].filter(
    (task) => !task.done_date && !isAutomaticTask(task),
  );
  sortedTasks.sort(compareTasks);
  const nextTask = sortedTasks[0] ?? null;
  const today = localTodayKey(now);
  const closingDate = dayKey(deal.expected_closing_date);

  // Een verlopen voorstel gaat voor op wat er verder gepland staat: het bepaalt
  // wat er met deze opdracht moet gebeuren, ongeacht welke taak eronder hangt.
  if (hasExpiredProposal(deal, today)) {
    return {
      kind: "proposal_expired",
      nextTask,
      openTaskCount: sortedTasks.length,
      resumeTask: null,
      proposalValidUntil: deal.proposal_valid_until ?? null,
    };
  }

  if (nextTask) {
    const due = dayKey(nextTask.due_date);
    const kind: DealWorkflowKind =
      due && due < today
        ? "overdue"
        : due === today
          ? "today"
          : closingDate && closingDate < today
            ? "overdue_closing"
            : !due
              ? "unscheduled"
              : // Een geplande taak in de toekomst laat een opdracht er verzorgd
                // uitzien terwijl hij al weken niet van zijn plaats komt. Dat is
                // precies de blinde vlek: alles op orde, niets in beweging.
                isStalled(deal, now)
                ? "stalled"
                : "scheduled";
    return {
      kind,
      nextTask,
      openTaskCount: sortedTasks.length,
      resumeTask: null,
      ...(kind === "stalled" && { daysOnStage: daysOnStage(deal, now) }),
    };
  }

  if (closingDate && closingDate < today) {
    return {
      kind: "overdue_closing",
      nextTask: null,
      openTaskCount: 0,
      resumeTask: null,
    };
  }

  return {
    kind: "missing",
    nextTask: null,
    openTaskCount: 0,
    resumeTask: null,
  };
};

const workflowPriority: Record<DealWorkflowKind, number> = {
  overdue: 0,
  today: 1,
  overdue_closing: 2,
  proposal_expired: 3,
  missing: 4,
  unscheduled: 5,
  // Onderaan de aandachtsrij, en dat is de bedoeling: stilstand is geen
  // afspraak die je vandaag breekt, maar wel iets dat je moet zien.
  stalled: 6,
  scheduled: 7,
  on_hold: 8,
  complete: 9,
};

const attentionWorkflowKinds = new Set<DealWorkflowKind>([
  "overdue",
  "today",
  "overdue_closing",
  "proposal_expired",
  "missing",
  "unscheduled",
  "stalled",
]);

export const needsDealAttention = (workflow: DealWorkflow): boolean =>
  attentionWorkflowKinds.has(workflow.kind);

export type RankedDealWorkflow = {
  deal: Deal;
  workflow: DealWorkflow;
};

/**
 * Waarop twee opdrachten met dezelfde urgentie onderling worden geordend.
 *
 * De laatste terugval was `updated_at`, en dat veld werd door niets bijgewerkt:
 * feitelijk stond er de aanmaakdatum, waardoor een oude opdracht zonder taak en
 * zonder einddatum bovenaan de aandachtslijst kwam alsof hij het langst
 * overtijd was. `stage_since` weet wel echt hoelang iets op deze stap staat, en
 * dat is precies de vraag bij werk zonder afspraak.
 */
const sortKeyFor = ({ deal, workflow }: RankedDealWorkflow): string | null => {
  if (workflow.kind === "overdue_closing")
    return deal.expected_closing_date ?? null;
  // Bij deze twee is de eigen datum de reden dat de opdracht in de rij staat:
  // het langst verlopen voorstel en het langst stilstaande werk bovenaan.
  if (workflow.kind === "proposal_expired")
    return deal.proposal_valid_until ?? null;
  if (workflow.kind === "stalled")
    return deal.stage_since ?? deal.created_at ?? null;
  return (
    workflow.nextTask?.due_date ??
    deal.expected_closing_date ??
    deal.stage_since ??
    deal.created_at ??
    null
  );
};

export const rankDealsForAttention = (
  deals: Deal[],
  tasksByDeal: Map<Identifier, Task[]>,
  now: Date = new Date(),
): RankedDealWorkflow[] =>
  deals
    .map((deal) => ({
      deal,
      workflow: getDealWorkflow(deal, tasksByDeal.get(deal.id) ?? [], now),
    }))
    .filter(({ workflow }) => needsDealAttention(workflow))
    .sort((left, right) => {
      const priority =
        workflowPriority[left.workflow.kind] -
        workflowPriority[right.workflow.kind];
      if (priority !== 0) return priority;

      const leftDue = dayKey(sortKeyFor(left));
      const rightDue = dayKey(sortKeyFor(right));
      return (leftDue ?? "9999-12-31").localeCompare(rightDue ?? "9999-12-31");
    });

export type DealAttentionCounts = {
  overdue: number;
  planning: number;
  stalled: number;
  today: number;
  total: number;
  unplanned: number;
};

export const summarizeDealAttention = (
  rankedDeals: RankedDealWorkflow[],
): DealAttentionCounts =>
  rankedDeals.reduce<DealAttentionCounts>(
    (counts, { workflow }) => {
      counts.total += 1;
      if (workflow.kind === "overdue") counts.overdue += 1;
      else if (workflow.kind === "today") counts.today += 1;
      // Een verlopen voorstel telt mee als verlopen planning: het is dezelfde
      // soort afspraak met een datum die voorbij is, en een eigen filterknop die
      // maandenlang op nul staat is geen knop maar ruis.
      else if (
        workflow.kind === "overdue_closing" ||
        workflow.kind === "proposal_expired"
      )
        counts.planning += 1;
      else if (workflow.kind === "stalled") counts.stalled += 1;
      else if (workflow.kind === "missing" || workflow.kind === "unscheduled")
        counts.unplanned += 1;
      return counts;
    },
    { overdue: 0, planning: 0, stalled: 0, today: 0, total: 0, unplanned: 0 },
  );
