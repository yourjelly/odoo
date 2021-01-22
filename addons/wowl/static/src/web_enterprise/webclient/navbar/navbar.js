/** @odoo-module **/
const { hooks } = owl;
import { NavBar } from "../../../webclient/navbar/navbar";
import { useService } from "../../../core/hooks";
import { burgerMenu } from "../burger_menu/burger_menu";
import { MobileSwitchCompanyMenu } from "../burger_menu/mobile_switch_company_menu/mobile_switch_company_menu";

const { useRef } = hooks;
export class EnterpriseNavBar extends NavBar {
  constructor() {
    super(...arguments);
    this.menus = useService("menus");
    this.actionManager = useService("action_manager");
    this.device = useService("device");
    this.hm = useService("home_menu");
    this.menuAppsRef = useRef("menuApps");
    this.hasBackgroundAction = false;
    hooks.onMounted(() => {
      this.env.bus.on("HOME-MENU:TOGGLED", this, () => this._updateMenuAppsIcon());
      this.env.bus.on("ACTION_MANAGER:UI-UPDATED", this, (mode) => {
        if (mode !== "new") {
          this.hasBackgroundAction = true;
        }
      });
    });
    hooks.onPatched(() => {
      this._updateMenuAppsIcon();
    });
  }
  get currentApp() {
    return !this.device.isMobileOS && !this.hm.hasHomeMenu ? super.currentApp : undefined;
  }
  _updateMenuAppsIcon() {
    const menuAppsEl = this.menuAppsRef.el;
    const hasHomeMenu = this.hm.hasHomeMenu;
    const hasAction = this.hasBackgroundAction;
    menuAppsEl.classList.toggle("o_hidden", hasHomeMenu && !hasAction);
    menuAppsEl.classList.toggle("fa-th", !hasHomeMenu);
    menuAppsEl.classList.toggle("fa-chevron-left", hasHomeMenu && hasAction);
  }
}
EnterpriseNavBar.template = "wowl.EnterpriseNavBar";
