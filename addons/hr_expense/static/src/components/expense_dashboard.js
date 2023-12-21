/** @odoo-module */

import { getCurrency } from '@web/core/currency';
import { orm } from "@web/core/orm";
import { Component, onWillStart, useState } from "@odoo/owl";

export class ExpenseDashboard extends Component {
    static template = "hr_expense.ExpenseDashboard";

    setup() {
        super.setup();

        this.state = useState({
            expenses: {}
        });

        onWillStart(async () => {
            const expense_states = await orm.call("hr.expense", 'get_expense_dashboard', []);
            this.state.expenses = expense_states;
        });
    }

    renderMonetaryField(value, currency_id) {
        value = value.toFixed(2);
        const currency = getCurrency(currency_id);
        if (currency) {
            if (currency.position === "after") {
                value += currency.symbol;
            } else {
                value = currency.symbol + value;
            }
        }
        return value;
    }
}
