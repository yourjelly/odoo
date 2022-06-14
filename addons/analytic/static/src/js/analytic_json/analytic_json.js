/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/fields/standard_field_props";

const { Component } = owl;


export class AnalyticJson extends Component {
    setup(){
        console.log('Analytic Json ---->');
        console.log(this.props);
    }
}
AnalyticJson.template = "analytic_json";
AnalyticJson.supportedTypes = ["char", "binary"];
AnalyticJson.props = {
    ...standardFieldProps,
}

registry.category("fields").add("analytic_json", AnalyticJson);
