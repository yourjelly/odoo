import { ActionContainer, ActionMangerUpdateInfo } from "../../services/action_manager/action_manager";
import { Component, tags, useState } from "@odoo/owl";
import { NavBar } from "../navbar/navbar";
import { OdooEnv } from "../../types";
import { useService } from '../../core/hooks';

class HomeMenuDemo extends Component<{}, OdooEnv> {
  menuRepo = useService('menus');
  static template = tags.xml`
    <div class="o_home_menu">
      HOME MENUUUUUUUU
      <t t-foreach="menuRepo.getApps()" t-as="app" t-key="app.id">
        <button t-on-click="_onMenuClicked(app)"><t t-esc="app.name" /></button>
      </t>
    </div>
  `;
  _onMenuClicked(menu: any) {
    this.menuRepo.setCurrentMenu(menu);
  }
}

export class WebClient extends Component<{}, OdooEnv> {
  static components = { ActionContainer, NavBar , HomeMenuDemo};
  static template = "wowl.WebClient";
  Components = this.env.registries.Components.getEntries();
  state = useState({hasHomeMenu: false});

  constructor(...args: any[]) {
    super(...args);
    this.env.bus.on('ACTION_MANAGER:UPDATE', this, (info: ActionMangerUpdateInfo) => {
      if (info.type === 'MAIN') {
        this.state.hasHomeMenu = false;
      }
    });
  }

  _onToggleHomeMenu() {
    this.state.hasHomeMenu = !this.state.hasHomeMenu;
  }

}
