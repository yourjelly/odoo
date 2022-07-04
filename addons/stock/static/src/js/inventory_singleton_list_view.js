/** @odoo-module */

import { registry } from "@web/core/registry";
import { InventoryReportListView } from './inventory_report_list_view';
import { SingletonListController } from './inventory_singleton_list_controller';
import { SingletonListRenderer } from './inventory_singleton_list_renderer';

export const SingletonListView = {
    ...InventoryReportListView,
    Controller: SingletonListController,
    Renderer: SingletonListRenderer,
    buttonTemplate: 'stock.InventoryAdjustments.Buttons',
}

registry.category("views").add("singleton_list", SingletonListView);
