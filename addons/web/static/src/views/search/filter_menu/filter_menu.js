/** @odoo-module **/

import { SearchComponent } from "../search_component";
import { FACET_ICONS } from "../search_utils";

const { QWeb } = owl;

export class FilterMenu extends SearchComponent {
  setup() {
    super.setup();
    this.icon = FACET_ICONS.filter;
  }

  get items() {
    return this.env.searchModel.getSearchItems((searchItem) =>
      ["filter", "dateFilter"].includes(searchItem.type)
    );
  }

  onDropdownItemSelected(ev) {
    const { itemId, optionId } = ev.detail.payload;
    if (optionId) {
      this.env.searchModel.toggleDateFilter(itemId, optionId);
    } else {
      this.env.searchModel.toggleSearchItem(itemId);
    }
  }
}

FilterMenu.template = "wowl.FilterMenu";

QWeb.registerComponent("FilterMenu", FilterMenu);
