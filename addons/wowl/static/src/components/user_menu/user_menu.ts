import { Component } from "@odoo/owl";
import { useService } from "../../core/hooks";
import { OdooEnv, SystrayItem } from "../../types";

export class UserMenu extends Component<{}, OdooEnv> {
  static template = "wowl.UserMenu";
  user = useService("user");
}

export const userMenuItem: SystrayItem = {
  name: "wowl.user_menu",
  Component: UserMenu,
};
