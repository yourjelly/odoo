/** @odoo-module **/
const { hooks } = owl;
import { NavBar } from "../../../webclient/navbar/navbar";
import { useService } from "../../../core/hooks";

const { useRef } = hooks;
export class EnterpriseNavBar extends NavBar {
  constructor() {
    super(...arguments);
    this.menus = useService("menus");
    this.actionManager = useService("action_manager");
    this.device = useService("device");
    this.hm = useService("home_menu");
    this.menuAppsRef = useRef("menuApps");
    hooks.onMounted(() => {
      this.env.bus.on("HOME-MENU:TOGGLED", this, () => this._updateMenuAppsIcon());
    });
    hooks.onPatched(() => {
      this._updateMenuAppsIcon();
    });
  }
  get currentApp() {
    return !this.device.isMobileOS ? super.currentApp : undefined;
  }
  _updateMenuAppsIcon() {
    const menuAppsEl = this.menuAppsRef.el;
    const hasHomeMenu = this.hm.hasHomeMenu;
    const hasAction = this.hm.hasBackgroundAction;
    menuAppsEl.classList.toggle("o_hidden", hasHomeMenu && !hasAction);
    menuAppsEl.classList.toggle("fa-th", !hasHomeMenu);
    menuAppsEl.classList.toggle("fa-chevron-left", hasHomeMenu && hasAction);
  }
}
EnterpriseNavBar.template = "wowl.EnterpriseNavBar";
