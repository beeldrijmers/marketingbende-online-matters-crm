import { useTranslate } from "ra-core";
import { Link } from "react-router";

import { AddTask } from "../tasks/AddTask";
import { SectionHeader } from "../layout/SectionHeader";
import { TasksListContent } from "../tasks/TasksListContent";
import { TASKS_PATH } from "../root/routes";

export const TasksList = () => {
  const translate = useTranslate();
  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <SectionHeader
        title={translate("crm.dashboard.upcoming_tasks", {
          _: "Aankomende taken",
        })}
        action={<AddTask display="icon" selectContact />}
      />
      <div className="panel p-3">
        <TasksListContent compact />
      </div>
      <Link
        to={TASKS_PATH}
        className="self-end text-meta text-ink-3 no-underline hover:text-ink"
      >
        {translate("crm.dashboard.all_tasks", { _: "Alle taken" })}
      </Link>
    </section>
  );
};
