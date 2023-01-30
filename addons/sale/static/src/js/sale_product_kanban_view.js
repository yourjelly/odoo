/** @odoo-module **/

import { registry } from "@web/core/registry";
import { KanbanModel } from '@web/views/kanban/kanban_model';
import { KanbanRecord } from '@web/views/kanban/kanban_record';
import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { kanbanView } from '@web/views/kanban/kanban_view';
import { Record } from "@web/views/relational_model";


/*
    The custom kanban view needs several extensions:

                        saleProductKanbanView
                        /                   \
                       /                     \
                      /                       \
                     /                         \
          SaleProductKanbanModel      SaleProductKanbanRenderer
                    |                           |
                    |                           |
                    |                           |
                    |                           |
          SaleProductCatalogRecord    SaleProductKanbanRecord
*/

export class SaleProductCatalogRecord extends Record {
    async _update(changes) {
        if ("sol_qty" in changes && Object.keys(changes).length === 1) {
            const action = await this.model.orm.call(
                this.resModel,
                "set_sol_qty",
                [this.resId, changes.sol_qty, false],
                { context: this.context }
            );
            if (action && action !== true) {
                await this.model.action.doAction(action, {
                    onClose: () => this.model.reloadRecords(this),
                });
            } else {
                await this.model.reloadRecords(this);
            }
            return;
        }
        super._update(changes);
    }
}

export class SaleProductKanbanModel extends KanbanModel {}
SaleProductKanbanModel.Record = SaleProductCatalogRecord;

export class SaleProductKanbanRecord extends KanbanRecord {
    onGlobalClick(ev) {
        // avoid a concurrent update when clicking on the buttons (that are inside the record)
        if (ev.target.closest('.o_sale_product_catalog_quantity')) {
            return;
        }
        const { openAction, fieldNodes } = this.props.archInfo;
        const { sol_qty } = fieldNodes;
        if (openAction &&
            ['sale_product_catalog_add_quantity','sale_product_catalog_remove_quantity',]
                .includes(openAction.action) &&
            sol_qty &&
            sol_qty.widget === 'sale_product_catalog_quantity') {
            let saleProductCatalogQty = this.props.record.data.sol_qty;
            if (openAction.action === 'sale_product_catalog_add_quantity') {
                saleProductCatalogQty++;
            } else {
                saleProductCatalogQty--;
            }
            this.props.record.update({ sol_qty: saleProductCatalogQty })
            return;
        }
        return super.onGlobalClick(ev);
    }
}

export class SaleProductKanbanRenderer extends KanbanRenderer {}
SaleProductKanbanRenderer.components = {
    ...KanbanRenderer.components,
    KanbanRecord: SaleProductKanbanRecord,
};

export const saleProductKanbanView = {
    ...kanbanView,
    Model: SaleProductKanbanModel,
    Renderer: SaleProductKanbanRenderer,
};

registry.category('views').add('sale_product_kanban', saleProductKanbanView);
