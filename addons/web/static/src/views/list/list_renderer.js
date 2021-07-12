/** @odoo-module **/

import { useService } from "@web/core/service_hook";
import { CheckBox } from "@web/core/checkbox/checkbox";

const { Component } = owl;

export class ListRenderer extends Component {
    static template = "web.ListRenderer";
    static components = { CheckBox };

    setup() {
        this.actionService = useService("action");
        this.fields = this.props.fields;
        this.columns = this.props.info.columns;
    }

    formatRecord(record, fieldName) {
        const value = record[fieldName];
        const field = this.fields[fieldName];
        switch (field.type) {
            case "many2one":
                return value ? value[1] : "";
            default:
                return value;
        }
    }

    openRecord(record) {
        const resIds = this.props.model.root.data.map((datapoint) => datapoint.resId);
        this.actionService.switchView("form", { resId: record.id, resIds });
    }
}
