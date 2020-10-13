import { Component, useState } from "@odoo/owl";
import { useService } from "../../core/hooks";
import { OdooEnv } from "../../types";

export class NavBar extends Component<{}, OdooEnv> {
  static template = "wowl.NavBar";
  actionManager = useService("action_manager");
  menuRepo = useService("menus");
  state = useState({ showDropdownMenu: false });

  systrayItems = this._getSystrayItems();

  toggleDropdownMenu() {
    this.state.showDropdownMenu = !this.state.showDropdownMenu;
  }

  _getSystrayItems() {
    return this.env.registries.systray.getAll().sort((x, y) => {
      const xSeq = x.sequence ?? 50;
      const ySeq = y.sequence ?? 50;
      return ySeq - xSeq;
    });
  }

  _onMenuClicked(menu: any) {
    this.actionManager.doAction(menu.actionID, { clearBreadcrumbs: true });
    this.state.showDropdownMenu = false;
  }
}
