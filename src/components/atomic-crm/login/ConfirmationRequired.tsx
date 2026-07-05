import { MailCheck } from "lucide-react";
import { Notification } from "@/components/admin/notification";
import { useTranslate } from "ra-core";
import { useConfigurationContext } from "../root/ConfigurationContext";

export const ConfirmationRequired = () => {
  const translate = useTranslate();
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();

  return (
    <div className="min-h-screen flex flex-col p-8">
      <div className="flex items-center gap-2">
        <img className="[.light_&]:hidden h-6" src={darkModeLogo} alt={title} />
        <img className="[.dark_&]:hidden h-6" src={lightModeLogo} alt={title} />
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-sm w-full flex flex-col items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="size-6" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {translate("crm.auth.welcome_title", {
              _: "Welcome to %{title}",
              title,
            })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate("crm.auth.confirmation_required", {
              _: "Please follow the link we just sent you by email to confirm your account.",
            })}
          </p>
        </div>
      </div>
      <Notification />
    </div>
  );
};

ConfirmationRequired.path = "/sign-up/confirm";
