/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class BooleanFavoriteField extends Component {
    get label() {
        return this.props.value
            ? this.env._t("Remove from Favorites")
            : this.env._t("Add to Favorites");
    }
}
BooleanFavoriteField.template = "web.BooleanFavoriteField";

BooleanFavoriteField.supportedFieldTypes = ["boolean"];

registry.category("fields").add("boolean_favorite", BooleanFavoriteField);
