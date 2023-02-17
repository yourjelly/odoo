/** @odoo-module **/

import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import { EmployeeListController } from "@hr/views/list_view";


export const myAllocationsListView = {
    ...listView,
    buttonTemplate: "hr_holidays.myAllocations.ListView.Buttons",
};

registry.category("views").add("my_allocations_list_view", myAllocationsListView);
