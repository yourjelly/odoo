/** @odoo-module **/

import { SearchComponent } from "../search_component";
import { FACET_ICONS, GROUPABLE_TYPES } from "../search_utils";
import { CustomGroupByItem } from "./custom_group_by_item";

const { QWeb } = owl;

export class GroupByMenu extends SearchComponent {
  setup() {
    super.setup();
    this.icon = FACET_ICONS.groupBy;
    this.fields = [];
    for (const [fieldName, field] of Object.entries(this.env.searchModel.fields)) {
      if (this.validateField(fieldName, field)) {
        this.fields.push(Object.assign({ name: fieldName }, field));
      }
    }
    this.fields.sort(({ string: a }, { string: b }) => (a > b ? 1 : a < b ? -1 : 0));
  }

  get items() {
    return this.env.searchModel.getSearchItems((searchItem) =>
      ["groupBy", "dateGroupBy"].includes(searchItem.type)
    );
  }

  validateField(fieldName, field) {
    const { sortable, type } = field;
    return fieldName !== "id" && sortable && GROUPABLE_TYPES.includes(type);
  }

  onDropdownItemSelected(ev) {
    const { itemId, optionId } = ev.detail.payload;
    if (optionId) {
      this.env.searchModel.toggleDateGroupBy(itemId, optionId);
    } else {
      this.env.searchModel.toggleSearchItem(itemId);
    }
  }
}

GroupByMenu.template = "wowl.GroupByMenu";
GroupByMenu.components = { CustomGroupByItem };

QWeb.registerComponent("GroupByMenu", GroupByMenu);
