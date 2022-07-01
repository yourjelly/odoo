/** @odoo-module */

import { ListController } from '@web/views/list/list_controller';

export class InventoryReportListController extends ListController {
    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    /**
     * Handler called when the user clicked on the 'Inventory at Date' button.
     * Opens wizard to display, at choice, the products inventory or a computed
     * inventory at a given date.
     */
    _onClickOpenWizard() {
        const stateContext = this.props.context;
        const context = {
            active_model: this.props.resModel,
        };
        if (stateContext.default_product_id) {
            context.product_id = stateContext.default_product_id;
        } else if (stateContext.product_tmpl_id) {
            context.product_tmpl_id = stateContext.product_tmpl_id;
        }
        this.actionService.doAction({
            res_model: 'stock.quantity.history',
            views: [[false, 'form']],
            target: 'new',
            type: 'ir.actions.act_window',
            context: context,
        });
    }
}
