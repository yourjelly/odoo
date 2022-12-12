/** @odoo-module */

import { onWillStart } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { ColumnProgress } from "@web/views/kanban/column_progress";
import { session } from "@web/session";

export class CrmColumnProgress extends ColumnProgress {
    setup() {
        super.setup();
        this.user = useService("user");
        this.showRecurringRevenue = false;

        onWillStart(async () => {
            if (this.props.progressAttributes.recurring_revenue_sum_field) {
                this.showRecurringRevenue = await this.user.hasGroup("crm.group_use_recurring_revenues");
            }
        });
    }

    getRecurringRevenueGroupAggregate(group) {
        const rrField = this.props.progressAttributes.recurring_revenue_sum_field;
        const value = group.getAggregates(rrField.name);
        const title = rrField.string || this.env._t("Count");
        let currency = false;
        if (value && rrField.currency_field) {
            currency = session.currencies[session.company_currency_id];
        }
        return { value, currency, title };
    }
}

CrmColumnProgress.props = {
    ...ColumnProgress.props,
    progressAttributes: true,
}
CrmColumnProgress.template = "crm.ColumnProgress";
