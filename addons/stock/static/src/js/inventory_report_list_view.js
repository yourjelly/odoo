/** @odoo-module */

import { listView } from '@web/views/list/list_view';
import { registry } from "@web/core/registry";
import { InventoryReportListController } from './inventory_report_list_controller';

export const InventoryReportListView = {
    ...listView,
    Controller: InventoryReportListController,
    buttonTemplate: 'stock.InventoryReport.Buttons',
};

registry.category("views").add("inventory_report_list", InventoryReportListView);
