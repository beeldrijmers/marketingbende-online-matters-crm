import { useTranslate } from "ra-core";

import { PageHeader } from "../layout/PageHeader";
import { AddTask } from "./AddTask";
import { TasksListContent } from "./TasksListContent";

/**
 * Desktop task list.
 *
 * /tasks used to redirect to the dashboard on desktop, so the task list only
 * existed on the phone — while the sidebar now offers it on every screen size.
 */
export const TasksPage = () => {
  const translate = useTranslate();
  return (
    <>
      <PageHeader
        title={translate("resources.tasks.name", {
          smart_count: 2,
          _: "Taken",
        })}
        meta={translate("resources.tasks.page_meta", {
          _: "Uw taken op vervaldatum, plus openstaande stappen om over te nemen",
        })}
        actions={<AddTask selectContact />}
      />
      <div className="max-w-3xl">
        <TasksListContent />
      </div>
    </>
  );
};
