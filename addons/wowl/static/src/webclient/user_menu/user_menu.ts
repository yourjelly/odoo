import { Component } from "@odoo/owl";
import { OwlEvent } from "@odoo/owl/dist/types/core/owl_event";
import { useService } from "../../core/hooks";
import { MenuElement, MenuItemEventPayload, OdooEnv } from "../../types";
import { DropdownItem } from "../../components/dropdown/dropdown_item";
import { Dropdown } from "../../components/dropdown/dropdown";
import { SystrayItem } from "../systray_registry";

export class UserMenu extends Component<{}, OdooEnv> {
  static template = "wowl.UserMenu";
  static components = { Dropdown, DropdownItem };
  source: string;
  user = useService("user");

  constructor() {
    super(...arguments);
    const { origin } = odoo.browser.location;
    const { userId } = this.user;
    this.source = `${origin}/web/image?model=res.users&field=image_128&id=${userId}`;
  }

  getElements(): MenuElement[] {
    const sortedItems = odoo.userMenuRegistry
      .getAll()
      .map((element) => element(this.env))
      .sort((x, y) => {
        const xSeq = x.sequence ? x.sequence : 100;
        const ySeq = y.sequence ? y.sequence : 100;
        return xSeq - ySeq;
      });
    return sortedItems;
  }

  onDropdownItemSelected(ev: OwlEvent<MenuItemEventPayload>) {
    ev.detail.payload.callback();
  }

  onClickOnTagA(ev: MouseEvent) {
    if (!ev.ctrlKey) {
      ev.preventDefault();
    }
  }
}

export const userMenu: SystrayItem = {
  name: "wowl.user_menu",
  Component: UserMenu,
  sequence: 0,
};
