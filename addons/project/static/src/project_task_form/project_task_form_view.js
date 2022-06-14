/** @odoo-module */

import { registry } from "@web/core/registry";
import { formView } from '@web/views/form/form_view';
import { ProjectTaskFormController } from './project_task_form_controller';

export const projectTaskFormView = {
    ...formView,
    Controller: ProjectTaskFormController,
};

registry.category("views").add("project_task_form", projectTaskFormView);
