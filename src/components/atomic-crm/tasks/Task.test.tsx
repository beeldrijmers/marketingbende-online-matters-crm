import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import type { DataProvider, UpdateParams } from "ra-core";

import { StoryWrapper, buildContact } from "@/test/StoryWrapper";
import type { Task as TaskRecord } from "../types";
import { Task } from "./Task";

const buildTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  contact_id: 1,
  deal_id: null,
  done_date: null,
  due_date: "2026-01-05T10:00:00.000Z",
  id: 1,
  sales_id: 0,
  source: "manual",
  text: "Call Ada about onboarding",
  trello_checkitem_id: null,
  type: "call",
  ...overrides,
});

describe("Task", () => {
  it("hides the delete action for Trello-synced steps", async () => {
    const trelloTask = buildTask({
      source: "trello",
      trello_checkitem_id: "checkitem-1",
    });

    const screen = await render(
      <StoryWrapper data={{ contacts: [buildContact()], tasks: [trelloTask] }}>
        <Task task={trelloTask} />
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "task actions" }).click();

    await expect
      .element(screen.getByRole("menuitem", { name: "Edit" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("menuitem", { name: "Delete" }))
      .not.toBeInTheDocument();
  });

  it("keeps the delete action for manual tasks", async () => {
    const manualTask = buildTask();

    const screen = await render(
      <StoryWrapper data={{ contacts: [buildContact()], tasks: [manualTask] }}>
        <Task task={manualTask} />
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "task actions" }).click();

    await expect
      .element(screen.getByRole("menuitem", { name: "Delete" }))
      .toBeInTheDocument();
  });

  it("updates the task only once when the checkbox is tapped on mobile", async () => {
    // Mobile viewport: the whole row also toggles the task on tap, so without
    // stopPropagation on the checkbox a single tap would fire two updates.
    await page.viewport(414, 896);

    const manualTask = buildTask();
    let updateCalls = 0;
    // Cast: the stub always returns a Task while DataProvider["update"] is
    // generic over the record type.
    const update = (async (_resource: string, params: UpdateParams) => {
      updateCalls += 1;
      return { data: { ...manualTask, ...params.data } };
    }) as DataProvider["update"];

    const screen = await render(
      <StoryWrapper
        data={{ contacts: [buildContact()], tasks: [manualTask] }}
        dataProvider={{ update }}
      >
        <Task task={manualTask} />
      </StoryWrapper>,
    );

    await screen.getByRole("checkbox").click();

    await expect.poll(() => updateCalls).toBe(1);
    // Give a potential duplicate row-level toggle time to fire before asserting.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(updateCalls).toBe(1);
  });
});
