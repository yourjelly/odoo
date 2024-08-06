/** @odoo-module */

import { registry } from '@web/core/registry';

import { listView } from '@web/views/list/list_view';
import { ListController } from '@web/views/list/list_controller';

import { useArchiveEmployee } from '@hr/views/archive_employee_hook';

export class EmployeeListController extends ListController {
    setup() {
        super.setup();
        this.archiveEmployee = useArchiveEmployee();
    }

    getStaticActionMenuItems() {
        const menuItems = super.getStaticActionMenuItems();
        const selectedRecords = this.model.root.selection;

        const activeEmployees = selectedRecords
            .filter(record => record.data.active).map(record => record.resId);
        if (activeEmployees.length > 0) {
            menuItems.archive.callback = this.archiveEmployee.bind(this, activeEmployees);
        }
        return menuItems;
    }
}

registry.category('views').add('hr_employee_list', {
    ...listView,
    Controller: EmployeeListController,
});
