/** @odoo-module */

import { registry } from "@web/core/registry";
import { formViewWithHtmlExpander } from '../form_with_html_expander/form_view_with_html_expander';
import { ProjectTaskFormController } from './project_task_form_controller';
import { ProjectTaskFormModel } from "./project_task_form_model";

export const projectTaskFormView = {
    ...formViewWithHtmlExpander,
    Controller: ProjectTaskFormController,
    Model: ProjectTaskFormModel,
};

registry.category("views").add("project_task_form", projectTaskFormView);
