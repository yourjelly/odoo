/** @odoo-module */

import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";

import { Component } from "@odoo/owl";
import { PermissionPanel } from "../../components/permission_panel/permission_panel";


class ShareButtonWidget extends Component {
    static template = "share.Button";
    static props = {
        ...standardWidgetProps,
        text: { type: String },
        title: { type: String, optional: true },
        bgClass: { type: String, optional: true },
    };
    static components = {
        PermissionPanel,
    };
    static defaultProps = {
        title: "",
        bgClass: "text-bg-success",
    };

    get classes() {
        let classes = this.props.bgClass;
        if (this.props.text.length > 15) {
            classes += " o_small";
        } else if (this.props.text.length > 10) {
            classes += " o_medium";
        }
        return classes;
    }
}

export const shareButton = {
    component: ShareButtonWidget,
    extractProps: ({ attrs }) => {
        return {
            text: attrs.title || attrs.text,
            title: attrs.tooltip,
            bgClass: attrs.bg_color,
        };
    },
};

registry.category("view_widgets").add("share_button", shareButton);
