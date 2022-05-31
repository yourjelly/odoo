/** @odoo-module **/

import { registry } from "@web/core/registry";
import { KanbanArchParser } from "./kanban_arch_parser";
import { KanbanController } from "./kanban_controller";
import { KanbanModel } from "./kanban_model";
import { KanbanRenderer } from "./kanban_renderer";

export const kanbanView = {
    type: "kanban",
    display_name: "Kanban",
    icon: "oi oi-view-kanban",
    multiRecord: true,
    isMobileFriendly: true,
    Controller: KanbanController,
    Renderer: KanbanRenderer,
    Model: KanbanModel,
    ArchParser: KanbanArchParser,
    buttonTemplate: "web.KanbanView.Buttons",

    props: (genericProps, view) => {
        const { ArchParser } = view;
        const { arch, relatedModels, resModel } = genericProps;
        const archInfo = new ArchParser().parse(arch, relatedModels, resModel);
        const defaultGroupBy =
            genericProps.searchMenuTypes.includes("groupBy") && archInfo.defaultGroupBy;

        return {
            ...genericProps,
            Model: view.Model,
            Renderer: view.Renderer,
            buttonTemplate: view.buttonTemplate,
            archInfo,
            defaultGroupBy,
        };
    },
};

registry.category("views").add("kanban", kanbanView);
