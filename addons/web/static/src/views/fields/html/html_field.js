/** @odoo-module **/

import { registry } from "@web/core/registry";
import { TextField, textField } from "../text/text_field";

export class HtmlField extends TextField {
    static template = "web.HtmlField";
}
HtmlField.props = {
    displayFullSize: {type: Boolean, optional: true}
}

HtmlField.extractProps = ({ attrs }) => {
    return {
        displayFullSize: "displayFullSize" in attrs.options ? !!attrs.options.displayFullSize : true,
    };
};
export const htmlField = {
    ...textField,
    component: HtmlField,
};

registry.category("fields").add("html", htmlField);
