/** @odoo-module **/
//import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { ReportAction } from "@web/webclient/actions/reports/report_action";
import { ReplenishReportButtons } from "./replenish_report_buttons";
import { Layout } from "@web/search/layout";
import { WarehouseFilter } from "./warehouse_filter";
import { graphView } from "@web/views/graph/graph_view";
const { onWillStart, useState} = owl;
/*FIXME
const viewRegistry = require("web.view_registry"); //For graph controller (get)
END-FIXME*/
class ReplenishReport extends ReportAction{
    setup(){
        super.setup();
        this.context = useState(this.props.action.context);
        this.productId = this.context.active_id;
        this.resModel = this.context.active_model || this.context.params.active_model || 'product.template';
        const isTemplate = this.resModel === 'product.template';
        this.actionMethod = `action_product_${isTemplate ? 'tmpl_' : ''}forecast_report`;
        const reportName = `report_product_${isTemplate ? 'template' : 'product'}_replenishment`;
        
        this.title = this.props.action.name;
        this.reportUrl = `/report/html/stock.${reportName}/${this.productId}`;

        onWillStart(async () => {
            //onWillStart WarehouseFilter : updates context
            this.reportUrl += `?context=${JSON.stringify(this.context)}`;
        });
    }

    onWarehouseSelected(id){
        console.log("Selected Warehouse with id "+ id); //DEBUG
        //reload Report
    }

    updateContext(args){
        console.log("updateContext received : "+ JSON.stringify(args)); //DEBUG
        Object.assign(this.context, args);
    }

    reloadReport(additionalContext){
        console.log("reloadReport received : "+ JSON.stringify(additionalContext)); //DEBUG
    }


}

ReplenishReport.template = 'stock.ReplenishReport';
ReplenishReport.components = {ReplenishReportButtons, WarehouseFilter, Layout, graphView}; //ReplenishReportButtons, ReportReplenishmentHeader, ReportProductProductReplenishment
registry.category("actions").add("replenish_report", ReplenishReport);
//mount(ReplenishReport, document.body, { dev: true, env });