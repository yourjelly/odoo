/** @odoo-module alias=report.client_action **/

import ControlPanel from "web.ControlPanel";

import { registry } from "@web/core/registry";
import { breadcrumbsToLegacy } from "@web/legacy/utils";
import { useService } from "@web/core/service_hook";
const { Component, tags } = owl;

class ReportAction extends Component {
    setup() {
        this.actionService = useService("action");
        this.title = this.props.options.display_name || this.props.options.name;
    }

    breadcrumbClicked(ev) {
        // GES: FIXME
        // Also, need to handle the page reload
        this.actionService.restore(ev.detail.controllerID);
    }

    get breadcrumbs() {
        return breadcrumbsToLegacy(this.props.breadcrumbs);
    }

    print() {
        this.actionService.doAction({
            type: "ir.actions.report",
            report_type: "qweb-pdf",
            report_name: this.props.options.report_name,
            report_file: this.props.options.report_file,
            data: this.props.options.data || {},
            context: this.props.options.context || {},
            display_name: this.title,
        });
    }
}
ReportAction.components = { ControlPanel };
// GES: FIXME Use @DAM Control Panel & remove the event handler
ReportAction.template = tags.xml`
    <div class="h-100">
        <ControlPanel t-on-breadcrumb-clicked="breadcrumbClicked"
            title="title"
            action="props.action"
            breadcrumbs="breadcrumbs"
            withSearchBar="false"
        >
            <t t-set-slot="buttons">
                <button t-on-click="print" type="button" class="btn btn-primary">Print</button>
            </t>
        </ControlPanel>
        
        <iframe class="o_report_iframe" t-att-src="props.options.report_url" />
    </div>
`;

registry.category("actions").add("report.client_action", ReportAction); // TODO update name to ReportAction
