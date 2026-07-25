import { FileText, Import, Settings, User, Users } from "lucide-react";
import { CanAccess, useTranslate, useUserMenu } from "ra-core";
import { Link } from "react-router";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { ChangelogPage } from "../misc/ChangelogPage";
import { ImportPage } from "../misc/ImportPage";

/**
 * The account menu entries, shared by the desktop rail's user chip and the
 * mobile settings page. They rely on ra-core's UserMenuContext to close the
 * dropdown after navigating, so they must be rendered inside a <UserMenu>.
 */
const MenuLink = ({
  icon: Icon,
  label,
  to,
}: {
  icon: typeof User;
  label: string;
  to: string;
}) => {
  const userMenuContext = useUserMenu();
  return (
    <DropdownMenuItem asChild onClick={userMenuContext?.onClose}>
      <Link to={to} className="flex items-center gap-2">
        <Icon className="size-4" />
        {label}
      </Link>
    </DropdownMenuItem>
  );
};

export const UserMenuItems = () => {
  const translate = useTranslate();
  return (
    <>
      <MenuLink
        icon={User}
        to="/profile"
        label={translate("crm.profile.title")}
      />
      <CanAccess resource="sales" action="list">
        <MenuLink
          icon={Users}
          to="/sales"
          label={translate("resources.sales.name", { smart_count: 2 })}
        />
      </CanAccess>
      <CanAccess resource="configuration" action="edit">
        <MenuLink
          icon={Settings}
          to="/settings"
          label={translate("crm.settings.title")}
        />
      </CanAccess>
      <MenuLink
        icon={Import}
        to={ImportPage.path}
        label={translate("crm.header.import_data")}
      />
      <MenuLink
        icon={FileText}
        to={ChangelogPage.path}
        label={translate("crm.changelog.title")}
      />
    </>
  );
};
