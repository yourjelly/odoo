/** @odoo-module **/

import { registry } from "@web/core/registry";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { EmployeeKanbanModel } from "@hr/views/kanban_view";


export const emplyeeKanbanView = {
    ...kanbanView,
    Model: EmployeeKanbanModel,
    buttonTemplate: "hr_holidays.employee.KanbanView.Buttons",
};

registry.category("views").add("employee_kanban_view", emplyeeKanbanView);
