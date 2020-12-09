import { Component } from "@odoo/owl";
import { OwlEvent } from "@odoo/owl/dist/types/core/owl_event";
import { Dropdown } from "../../../components/dropdown/dropdown";
import { DropdownItem } from "../../../components/dropdown/dropdown_item";
import { FACET_ICONS, GeneratorId } from "../../view_utils/search_utils";
import { ViewEnv } from "../../graph/view";

export class FilterMenu extends Component<{}, ViewEnv> {
  static template = "wowl.FilterMenu";
  static components = { Dropdown, DropdownItem };

  icon: string;
  title: string;

  constructor() {
    super(...arguments);
    this.icon = FACET_ICONS.filter;
    this.title = this.env._t("Filters");
  }

  get items() {
    return this.env.model.getSearchItems((f) => ["filter", "dateFilter"].includes(f.type));
  }

  onDropdownItemSelected(ev: OwlEvent<{ payload: { itemId: number; optionId?: GeneratorId } }>) {
    const { itemId, optionId } = ev.detail.payload;
    if (optionId) {
      this.env.model.toggleDateFilter(itemId, optionId);
    } else {
      this.env.model.toggleSearchItem(itemId);
    }
  }
}
