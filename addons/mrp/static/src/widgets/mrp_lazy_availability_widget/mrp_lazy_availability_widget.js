/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

export class MrpLazyLoading extends Component {
    static template = "mrp.LazyLoading";
    static props = { ...standardWidgetProps };
    setup() {
        this.state = useState({
            loading: true,
            value: {},
        });
        this.lazyLoading = useService("mrp_lazy_loading");

        onWillStart(() => {
            this.lazyLoading.call(this.props.record.resId).then((value) => {
                this.state.value = value;
                this.state.loading = false;
            });
        });
    }

    get components_availability() {
        return this.state.value?.components_availability || "";
    }

    get decorator() {
        const state = this.state.value.components_availability_state;
        const reservationState = this.state.value.reservation_state;

        if (reservationState == "assigned" || state == "available") {
            return "text-success";
        }
        if (reservationState != "assigned" && (state == "available" || state == "expected")) {
            return "text-warning";
        }
        if (reservationState != "assigned" && (state == "late" || state == "unavailable")) {
            return "text-danger";
        }
        return "";
    }
}

MrpLazyLoading.template = "mrp.LazyLoading";

export const mrpLazyLoading = {
    component: MrpLazyLoading,
    label: _t("Components Availability"),
};

registry.category("view_widgets").add("mrp_lazy_widget", mrpLazyLoading);
