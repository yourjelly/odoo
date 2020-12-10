import { Component, hooks } from "@odoo/owl";
import { FieldDefinition } from "../../graph/types";
import { SearchModel } from "../search_model";
import { Dropdown } from "../../../components/dropdown/dropdown";
import { DropdownItem } from "../../../components/dropdown/dropdown_item";
import { OdooEnv } from "../../../types";
const { useState } = hooks;

export class CustomGroupByItem extends Component<
  { searchModel: SearchModel; fields: (FieldDefinition & { name: string })[] },
  OdooEnv
> {
  static template = "wowl.CustomGroupByItem";
  static components = { DropdownItem, Dropdown };

  state: { fieldName: string } = useState({ fieldName: this.props.fields[0].name });

  onApply() {
    const field = this.props.fields.find((f) => f.name === this.state.fieldName)!;
    this.props.searchModel.createNewGroupBy(field);
  }
}
