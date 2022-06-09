/** @odoo-module **/

import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { ProgressBarField } from "@web/fields/progress_bar";

export class SalesTeamProgressBar extends ProgressBarField {
    setup() {
        super.setup();
        this.state = useState({
            isUnset: !this.state.maxValue,
        });
    }
}

SalesTeamProgressBar.template = "sale.SalesTeamProgressBar";
registry.category('fields').add('sales_team_progressbar', SalesTeamProgressBar);
