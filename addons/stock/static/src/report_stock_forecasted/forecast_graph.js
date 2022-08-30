/** @odoo-module **/
import { registry } from "@web/core/registry";
import { graphView } from "@web/views/graph/graph_view";
const { Component, onWillStart, useState} = owl;

/*
type : line
*/


export class ForecastGraph extends graphView.Controller{
    setup(){
        this.viewRegistry = registry.category("views");
        this.orm = useService("orm");
        /* PROPS :
        active_warehouse.id
        productId
        resModel
        actionMethod
        context
        */
    }

    /**
     * @override
     */
    setup() {
        this.orm = useService('orm');
        super.setup();
    }

    /**
     * @override
     */
    openView(domain, views, context) {
        const model = "report.stock.quantity";
        orm.call(model,
             'get_views',
             [[[false, "graph"]]]/*, {
                context: context,
                domain: domain,
                fields: ['id'], // id is equal to contract_id
            },*/
        ).then((res) => {
            const domain = _getReportDomain;
            actionService.doAction({
                type: "ir.actions.act_window",
                name: title,
                res_model: model,
                views: [[false, "list"], [false, "form"]],
                view_mode: "list",
                target: "current",
                context,
                domain: domain,
            });
        })
    }


    async _createGraphController() {
        const model = "report.stock.quantity";
        const viewsInfo = await this.orm.call(
            model,
            "get_views",
            [[[false, "graph"]]]
        );
        const viewInfo = viewsInfo.views.graph;
        viewInfo.fields = viewsInfo.models[model];
        const params = {
            domain: this._getReportDomain(), //TODO
            modelName: model,
            noContentHelp: this.env._t("Try to add some incoming or outgoing transfers."),
            withControlPanel: false,
            context: {fill_temporal: false},
        };

        //still good ?
        const GraphView = viewRegistry.get("graphView");

        //Possibly Not good from here
        const graphView = new GraphView(viewInfo, params);
        const graphController = await graphView.getController(this);
        await graphController.appendTo(document.createDocumentFragment());

        // Since we render the container in a fragment, we may endup in this case:
        // https://github.com/chartjs/Chart.js/issues/2210#issuecomment-204984449
        // so, the canvas won't be resizing when it is relocated in the iframe.
        // Also, since the iframe's position is absolute, chartJS reiszing may not work
        //  (https://www.chartjs.org/docs/2.9.4/general/responsive.html -- #Important Note)
        // Finally, we do want to set a height for the canvas rendering in chartJS.
        // We do this via the chartJS API, that is legacy/graph_renderer.js:@_prepareOptions
        //  (maintainAspectRatio = false) and with the *attribute* height (not the style).
        //  (https://www.chartjs.org/docs/2.9.4/general/responsive.html -- #Responsive Charts)
        // Luckily, the chartJS is not fully rendered, so changing the height here is relevant.
        // It wouldn't be if we were after GraphRenderer@mounted.
        graphController.el.querySelector(".o_graph_canvas_container canvas").height = "300";

        return graphController;
    }

    _createGraphView() {
        const graphPromise = this._createGraphController();
        //In declarative style, ForecastGraph is now a Component, the following is no longer needed/appropriate
        this.iframe.addEventListener("load",
            () => this._appendGraph(graphPromise),
            { once: true }
        );
    }

    _getReportDomain() {
        const domain = [
            ['state', '=', 'forecast'],
            ['warehouse_id', '=', this.active_warehouse.id],
        ];
        if (this.resModel === 'product.template') {
            domain.push(['product_tmpl_id', '=', this.productId]);
        } else if (this.resModel === 'product.product') {
            domain.push(['product_id', '=', this.productId]);
        }
        return domain;
    }

    _getForecastedReportAction() {
        return this._rpc({
            model: this.resModel,
            method: this.actionMethod,
            args: [this.productId],
            context: this.context,
        });
    }

    _reloadReport(additionnalContext) {
        return this._getForecastedReportAction().then((action) => {
            action.context = Object.assign({
                active_id: this.productId,
                active_model: this.resModel,
            }, this.context, additionnalContext);
            return this.do_action(action, { stackPosition: 'replaceCurrentAction' });
        });
    }
}