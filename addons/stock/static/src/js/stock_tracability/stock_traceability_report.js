/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";

const { Component, onWillStart } = owl;


export class StockTracabilityReport extends Component {
    setup() {
        this.orm = useService("orm");

        onWillStart(async () => {
            this.lines = await this.orm.call(
                "stock.traceability.report",
                "get_html",
                [],
                { context: this.props.context }
            );
        });
    }
}

StockTracabilityReport.template = "stock.stockTracabilityReport";
