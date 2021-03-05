/** @odoo-module **/

import { SearchComponent } from "../search_component";

const { useState } = owl.hooks;

export class CustomGroupByItem extends SearchComponent {
  setup() {
    super.setup();
    this.state = useState({});
    if (this.props.fields.length) {
      this.state = this.props.fields[0].name;
    }
  }

  onApply() {
    const field = this.props.fields.find((f) => f.name === this.state.fieldName);
    this.env.searchModel.createNewGroupBy(field);
  }
}

CustomGroupByItem.template = "wowl.CustomGroupByItem";
