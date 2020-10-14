import { Component, useState } from "@odoo/owl";
import { useService } from "../../core/hooks";
import { OdooEnv } from "../../types";

export class NavBar extends Component<{}, OdooEnv> {
  static template = "wowl.NavBar";
  actionManager = useService("action_manager");
  menuRepo = useService("menus");
  state = useState({ showDropdownMenu: false });

  systrayItems = this.env.registries.systray.getAll();
  constructor(...args: any[]) {
    super(...args);
    this.env.bus.on("menus:app-changed", this, () => this.render());
  }

  toggleDropdownMenu() {
    this.state.showDropdownMenu = !this.state.showDropdownMenu;
  }

  _onMenuClicked(menu: any) {
    this.actionManager.doAction(menu.actionID, { clearBreadcrumbs: true , _menuId: menu.id});
    this.state.showDropdownMenu = false;
  }
  get currentApp() {
    const app = this.menuRepo.getCurentApp();
    return JSON.stringify(app || {});
  }
}
