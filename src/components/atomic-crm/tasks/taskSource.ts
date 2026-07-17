import type { Task } from "../types";

// Automatic tasks are a database guardrail: they make sure a newly-created
// actionable deal always has a dated row until someone supplies a real next
// action. They are deliberately not an agreed deadline, so they must never
// drive a user-facing urgency state.
export const isAutomaticTask = (task: Pick<Task, "source">): boolean =>
  task.source === "auto";
