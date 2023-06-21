/** @odoo-module */

import { registry } from '@web/core/registry';
import { Many2OneField, many2OneField } from '@web/views/fields/many2one/many2one_field';

export class ProjectPrivateTaskMany2OneField extends Many2OneField {
    get Many2XAutocompleteProps() {
        const props = super.Many2XAutocompleteProps;
        if (!this.props.record.data.project_root_id) {
            props.placeholder = this.env._t("Private");
        }
        return props;
    }
}
ProjectPrivateTaskMany2OneField.template = 'project.ProjectPrivateTaskMany2OneField';

export const projectPrivateTaskMany2OneField = {
    ...many2OneField,
    component: ProjectPrivateTaskMany2OneField,
    fieldDependencies: [
        ...(many2OneField.fieldDependencies || []),
        { name: "project_root_id", type: "many2one" },
    ],
};

registry.category("fields").add("project_private_task", projectPrivateTaskMany2OneField);
