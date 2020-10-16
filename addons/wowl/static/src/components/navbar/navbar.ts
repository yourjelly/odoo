import { Component, useState } from "@odoo/owl";
import { useService } from "../../core/hooks";
import { OdooEnv } from "../../types";

export class NavBar extends Component<{}, OdooEnv> {
  static template = "wowl.NavBar";
  actionManager = useService("action_manager");
  menuRepo = useService("menus");
  state = useState({ showDropdownMenu: false });
  constructor(...args: any[]) {
    super(...args);
    this.env.bus.on('MENUS:APP-CHANGED', this, () => this.render());
  }

  systrayItems = this.env.registries.systray.getAll();

  toggleDropdownMenu() {
    this.state.showDropdownMenu = !this.state.showDropdownMenu;
  }

  _onMenuClicked(menu: any) {
    this.menuRepo.setCurrentMenu(menu);
    this.state.showDropdownMenu = false;
  }
  get currentApp() {
    return this.menuRepo.getCurrentApp();
  }
}
