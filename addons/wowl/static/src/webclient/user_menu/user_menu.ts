import { Component } from "@odoo/owl";
import { OwlEvent } from "@odoo/owl/dist/types/core/owl_event";
import { useService } from "../../core/hooks";
import { MenuElement, MenuItemEventPayload, Odoo, OdooEnv, SystrayItem } from "../../types";
import { DropdownItem } from "../../components/dropdown/dropdown_item";
import { Dropdown } from "../../components/dropdown/dropdown";

declare const odoo: Odoo;

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

  getItemGroups(): MenuElement[][] {
    const filteredItems = [];
    for (const itemFactory of odoo.userMenuRegistry.getAll()) {
      const item = itemFactory(this.env);
      const { hide } = item;
      if (!hide) {
        filteredItems.push(item);
      }
    }
    const sortedItems = filteredItems.sort((x, y) => {
      const xSeq = x.sequence ? x.sequence : 100;
      const ySeq = y.sequence ? y.sequence : 100;
      return xSeq - ySeq;
    });
    const groups: MenuElement[][] = [[], []];
    for (const item of sortedItems) {
      const groupIndex = (item.sequence ? item.sequence : 100) < 40 ? 0 : 1;
      groups[groupIndex].push(item);
    }
    return groups;
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
