import { Component } from "@odoo/owl";
import { OwlEvent } from "@odoo/owl/dist/types/core/owl_event";
import { Dropdown } from "../../../components/dropdown/dropdown";
import { DropdownItem } from "../../../components/dropdown/dropdown_item";
import { FACET_ICONS } from "../../view_utils/search_utils";
import { SearchModel } from "../search_model";
import { OdooEnv } from "../../../types";

export class ComparisonMenu extends Component<{ searchModel: SearchModel }, OdooEnv> {
  static template = "wowl.ComparisonMenu";
  static components = { Dropdown, DropdownItem };

  icon: string = FACET_ICONS.comparison;
  title: string = this.env._t("Comparison");

  get items() {
    return this.props.searchModel.getSearchItems((searchItem) => searchItem.type === "comparison");
  }

  onDropdownItemSelected(ev: OwlEvent<{ payload: { itemId: number } }>) {
    const { itemId } = ev.detail.payload;
    this.props.searchModel.toggleSearchItem(itemId);
  }
}
