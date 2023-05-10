/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Many2OneField, ListMany2OneField, many2OneField, listMany2OneField } from "@web/views/fields/many2one/many2one_field";

const TaskWithHoursMixin = (component) => class extends component {
    get canCreate() {
        return Boolean(this.context.default_project_id);
    }

    /**
     * @override
     */
    get displayName() {
        const displayName = super.displayName;
        return displayName ? displayName.split('\u00A0')[0] : displayName;
    }

    /**
     * @override
     */
    get context() {
        return {...super.context, hr_timesheet_display_remaining_hours: true};
    }

    /**
     * @override
     */
    get Many2XAutocompleteProps() {
        const props = super.Many2XAutocompleteProps;
        if (!this.canCreate) {
            props.quickCreate = null;
        }
        return props;
    }

    /**
     * @override
     */
    computeActiveActions(props) {
        super.computeActiveActions(props);
        const activeActions = this.state.activeActions;
        activeActions.create = activeActions.create && this.canCreate;
        activeActions.createEdit = activeActions.create;
    }
}

export class TaskWithHours extends TaskWithHoursMixin(Many2OneField) {}
export class ListTaskWithHours extends TaskWithHoursMixin(ListMany2OneField) {}

export const taskWithHours = {
    ...many2OneField,
    component: TaskWithHours,
};

export const listTaskWithHours = {
    ...listMany2OneField,
    component: ListTaskWithHours,
}

registry.category("fields").add("task_with_hours", taskWithHours);
registry.category("fields").add("list.task_with_hours", listTaskWithHours);
