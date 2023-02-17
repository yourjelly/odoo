/** @odoo-module **/

import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import { EmployeeListController } from "@hr/views/list_view";


export const emplyeeListView = {
    ...listView,
    Controller: EmployeeListController,
    buttonTemplate: "hr_holidays.employee.ListView.Buttons",
};

registry.category("views").add("employee_list_view", emplyeeListView);
