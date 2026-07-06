import { CreateButton } from "@/components/admin/create-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle, Plus } from "lucide-react";
import type { Identifier } from "ra-core";
import { useTranslate } from "ra-core";
import { Link } from "react-router";

import { useIsMobile } from "@/hooks/use-mobile";
import { ContactImportButton } from "../contacts/ContactImportButton";
import useAppBarHeight from "../misc/useAppBarHeight";
import { useConfigurationContext } from "../root/ConfigurationContext";

export const DashboardStepper = ({
  step,
  contactId,
  onNewContact,
  onNewNote,
}: {
  step: number;
  contactId?: Identifier;
  // Opening the contact/note create sheets is delegated to the parent dashboard,
  // which hosts the sheets outside this stepper. That way creating a company from
  // the contact form (which makes the CRM non-empty and swaps the stepper out for
  // the real dashboard) no longer unmounts the still-open sheet mid-form.
  onNewContact?: () => void;
  onNewNote?: () => void;
}) => {
  const translate = useTranslate();
  const { title } = useConfigurationContext();
  const appbarHeight = useAppBarHeight();
  const isMobile = useIsMobile();
  return (
    <>
      <div
        className="flex justify-center items-center"
        style={{
          height: isMobile ? undefined : `calc(100dvh - ${appbarHeight}px)`,
        }}
      >
        <Card className="w-full max-w-[600px]">
          <CardContent className="px-6">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold">
                {translate("crm.dashboard.stepper.whats_next", {
                  _: "What's next?",
                })}
              </h3>
              <div className="w-[150px]">
                <Progress value={(step / 3) * 100} className="mb-2" />
                <div className="text-right text-sm">
                  {translate("crm.dashboard.stepper.progress", {
                    _: `${step}/3 done`,
                    step,
                  })}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-12">
              <div className="flex gap-8 items-center">
                <CheckCircle className="text-green-600 dark:text-green-500 w-5 h-5 shrink-0" />
                <h4 className="font-bold">
                  {translate("crm.dashboard.stepper.install", {
                    _: "Install %{title}",
                    title,
                  })}
                </h4>
              </div>
              <div className="flex gap-8 items-start">
                {step > 1 ? (
                  <CheckCircle className="text-green-600 dark:text-green-500 w-5 h-5 mt-1 shrink-0" />
                ) : (
                  <Circle className="text-muted-foreground w-5 h-5 mt-1 shrink-0" />
                )}

                <div className="flex flex-col gap-4">
                  <h4 className="font-bold">
                    {translate("resources.contacts.action.add_first", {
                      _: "Add your first contact",
                    })}
                  </h4>

                  <div className="flex gap-8">
                    {isMobile ? (
                      <Button
                        onClick={onNewContact}
                        className="gap-2"
                        variant="outline"
                      >
                        <Plus className="h-4 w-4" />
                        {translate("resources.contacts.action.new", {
                          _: "New Contact",
                        })}
                      </Button>
                    ) : (
                      <>
                        <CreateButton
                          label="resources.contacts.action.new"
                          resource="contacts"
                        />
                        <ContactImportButton />
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-8 items-start">
                <Circle className="text-muted-foreground w-5 h-5 mt-1 shrink-0" />
                <div className="flex flex-col gap-4">
                  <h4 className="font-bold">
                    {translate("resources.notes.action.add_first", {
                      _: "Add your first note",
                    })}
                  </h4>
                  <p>
                    {translate("resources.notes.stepper.hint", {
                      _: "Go to a contact page and add a note",
                    })}
                  </p>
                  {isMobile ? (
                    <Button
                      onClick={onNewNote}
                      disabled={step < 2}
                      className="w-fit gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      {translate("resources.notes.action.add", {
                        _: "Add note",
                      })}
                    </Button>
                  ) : (
                    <Button asChild disabled={step < 2} className="w-fit">
                      <Link role="button" to={`/contacts/${contactId}/show`}>
                        {translate("resources.notes.action.add", {
                          _: "Add note",
                        })}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
