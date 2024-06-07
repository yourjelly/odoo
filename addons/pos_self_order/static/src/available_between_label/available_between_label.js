import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { Component } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

class AvailableBetweenLabel extends Component {
    static template = "pos_self_order.AvailableBetweenLabel";
    static props = { ...standardWidgetProps };
    get tooltipInfo() {
        return JSON.stringify({ tooltip: _t("Only works for kiosk and mobile") });
    }
}

export const availableBetweenLabel = { component: AvailableBetweenLabel };

registry.category("view_widgets").add("available_between_label", availableBetweenLabel);
