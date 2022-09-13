/** @odoo-module **/

import { registry } from "@web/core/registry";
import { FormRenderer } from "./form_renderer";
import { RelationalModel } from "../basic_relational_model";
import { FormArchParser } from "./form_arch_parser";
import { FormController } from "./form_controller";
import { FormCompiler } from "./form_compiler";
import { FormControlPanel } from "./control_panel/form_control_panel";

export const formView = {
    type: "form",
    display_name: "Form",
    multiRecord: false,
    // display: { controlPanel: { ["top-right"]: false } },
    searchMenuTypes: [],
    ControlPanel: FormControlPanel,
    Controller: FormController,
    Renderer: FormRenderer,
    ArchParser: FormArchParser,
    Model: RelationalModel,
    Compiler: FormCompiler,
    buttonTemplate: "web.FormView.Buttons",

    props: (genericProps, view) => {
        const { ArchParser } = view;
        const { arch, relatedModels, resModel } = genericProps;
        const archInfo = new ArchParser().parse(arch, relatedModels, resModel);

        return {
            ...genericProps,
            Model: view.Model,
            Renderer: view.Renderer,
            buttonTemplate: genericProps.buttonTemplate || view.buttonTemplate,
            Compiler: view.Compiler,
            archInfo,
        };
    },
};

registry.category("views").add("form", formView);
