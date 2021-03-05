/** @odoo-module **/

import { SearchComponent } from "../search_component";
import { FACET_ICONS } from "../search_utils";

const { QWeb } = owl;

export class ComparisonMenu extends SearchComponent {
  setup() {
    super.setup();
    this.icon = FACET_ICONS.comparison;
  }

  get items() {
    return this.env.searchModel.getSearchItems((searchItem) => searchItem.type === "comparison");
  }

  onDropdownItemSelected(ev) {
    const { itemId } = ev.detail.payload;
    this.env.searchModel.toggleSearchItem(itemId);
  }
}

ComparisonMenu.template = "wowl.ComparisonMenu";

QWeb.registerComponent("ComparisonMenu", ComparisonMenu);
