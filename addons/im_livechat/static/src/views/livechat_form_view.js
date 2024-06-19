import { registry } from "@web/core/registry";
import { formView } from "@web/views/form/form_view";
import { LivechatFormRenderer } from "./livechat_form_renderer";

export const projectTaskFormView = {
    ...formView,
    // Controller: ProjectTaskFormController,
    Renderer: LivechatFormRenderer,
};

registry.category("views").add("livechat_form", projectTaskFormView);
