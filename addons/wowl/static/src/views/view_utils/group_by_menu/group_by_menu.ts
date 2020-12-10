import { Component } from "@odoo/owl";
import { SearchModel } from "../search_model";
import { Dropdown } from "../../../components/dropdown/dropdown";
import { DropdownItem } from "../../../components/dropdown/dropdown_item";
import { CustomGroupByItem } from "./custom_group_by_item";
import { FACET_ICONS, GROUPABLE_TYPES, IntervalId } from "../search_utils";
import { OwlEvent } from "@odoo/owl/dist/types/core/owl_event";
import { OdooEnv } from "../../../types";
import { FieldDefinition } from "../../graph/types";

export class GroupByMenu extends Component<{ searchModel: SearchModel }, OdooEnv> {
  static template = "wowl.GroupByMenu";
  static components = { DropdownItem, Dropdown, CustomGroupByItem };

  icon: string = FACET_ICONS.groupBy;
  title: string = this.env._t("Group By");

  fields: (FieldDefinition & { name: string })[] = [];

  constructor() {
    super(...arguments);
    for (const fieldName in this.props.searchModel.fields) {
      const field = this.props.searchModel.fields[fieldName];
      if (this.validateField(fieldName, field)) {
        this.fields.push(Object.assign({ name: fieldName }, field));
      }
    }
    this.fields.sort(({ string: a }, { string: b }) => (a > b ? 1 : a < b ? -1 : 0));
  }

  get items() {
    return this.props.searchModel.getSearchItems((searchItem) =>
      ["groupBy", "dateGroupBy"].includes(searchItem.type)
    );
  }

  validateField(fieldName: string, field: FieldDefinition) {
    const { type, sortable } = field;
    return fieldName !== "id" && sortable && GROUPABLE_TYPES.includes(type);
  }

  onDropdownItemSelected(ev: OwlEvent<{ payload: { itemId: number; optionId?: IntervalId } }>) {
    const { itemId, optionId } = ev.detail.payload;
    if (optionId) {
      this.props.searchModel.toggleDateGroupBy(itemId, optionId);
    } else {
      this.props.searchModel.toggleSearchItem(itemId);
    }
  }
}
