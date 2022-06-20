/** @odoo-module */

import { registry } from "@web/core/registry";
import { formView } from '@web/views/form/form_view';
import { ProjectTaskFormController } from './project_task_form_controller';
import { ProjectTaskFormModel } from "./project_task_form_model";

export const projectTaskFormView = {
    ...formView,
    Controller: ProjectTaskFormController,
    Model: ProjectTaskFormModel,
};

registry.category("views").add("project_task_form", projectTaskFormView);
