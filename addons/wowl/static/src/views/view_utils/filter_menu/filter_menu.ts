import { Component } from "@odoo/owl";
import { OwlEvent } from "@odoo/owl/dist/types/core/owl_event";
import { Dropdown } from "../../../components/dropdown/dropdown";
import { DropdownItem } from "../../../components/dropdown/dropdown_item";
import { FACET_ICONS, GeneratorId } from "../../view_utils/search_utils";
import { SearchModel } from "../search_model";
import { OdooEnv } from "../../../types";

export class FilterMenu extends Component<{ searchModel: SearchModel }, OdooEnv> {
  static template = "wowl.FilterMenu";
  static components = { Dropdown, DropdownItem };

  icon: string = FACET_ICONS.filter;
  title: string = this.env._t("Filters");

  get items() {
    return this.props.searchModel.getSearchItems((searchItem) =>
      ["filter", "dateFilter"].includes(searchItem.type)
    );
  }

  onDropdownItemSelected(ev: OwlEvent<{ payload: { itemId: number; optionId?: GeneratorId } }>) {
    const { itemId, optionId } = ev.detail.payload;
    if (optionId) {
      this.props.searchModel.toggleDateFilter(itemId, optionId);
    } else {
      this.props.searchModel.toggleSearchItem(itemId);
    }
  }
}
