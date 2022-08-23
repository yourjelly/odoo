/** @odoo-module */

import { formatFloat } from "@web/views/fields/formatters";
import { registry } from "@web/core/registry";
import { _lt } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";

const { Component } = owl;


class ForecastWidgetField extends Component {
    setup() {
        super.setup();
        this.actionService = useService("action");
        this.orm = useService("orm");
        const record = this.props.record.data;
        const field = this.props.record.fields;
        this.forecast_availability_str = formatFloat(
            record.forecast_availability,
            field.forecast_availability
        );
        this.reserved_availability_str = formatFloat(
            record.reserved_availability,
            field.reserved_availability
        );
        this.reserved_availability_str = formatFloat(
            record.forecast_expected_date,
            field.forecast_expected_date
        );
        if (record.forecast_expected_date && record.date_deadline) {
            this.forecast_is_late = record.forecast_expected_date > record.date_deadline;
        }
        this.will_be_fulfilled = formatFloat(record.forecast_availability, field.forecast_availability) >= formatFloat(record.product_qty, field.forecast_availability);
    }

    // //--------------------------------------------------------------------------
    // // Handlers
    // //--------------------------------------------------------------------------

    // /**
    //  * Opens the Forecast Report for the `stock.move` product.
    //  *
    //  * @param {MouseEvent} ev
    //  */
    async onOpenReport(ev) {
        ev.stopPropagation();
        if (! this.props.record.data.id) {
            return;
        }
        const action = await this.orm.call("stock.move", "action_product_forecast_report", [this.props.record.data.id])
        action.context = Object.assign(action.context || {}, {
            active_model: 'product.product',
            active_id: this.props.record.data.product_id[0],
        });
        this.actionService.doAction(action);
    }
};
ForecastWidgetField.supportedTypes = ["float"];
ForecastWidgetField.template = "stock.forecastWidget";

class jsonPpopOver extends Component {

    setup() {
        this.props = {...this.props, ...JSON.parse(this.props.value)};
        super.setup()
    }
};

jsonPpopOver.displayName = _lt("Json Popup");
jsonPpopOver.supportedTypes = ["char"];

class popOverLeadDays extends jsonPpopOver {};
popOverLeadDays.template = "stock.leadDaysPopOver";

class replenishmentHistoryWidget extends jsonPpopOver {};
replenishmentHistoryWidget.template = "stock.replenishmentHistory";

registry.category("fields").add("lead_days_widget", popOverLeadDays);
registry.category("fields").add("replenishment_history_widget", replenishmentHistoryWidget);
registry.category("fields").add("forecast_widget", ForecastWidgetField);
