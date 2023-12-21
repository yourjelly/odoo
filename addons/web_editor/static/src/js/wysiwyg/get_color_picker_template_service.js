
/** @odoo-module **/

import { orm } from "@web/core/orm";
import { registry } from "@web/core/registry";

let colorPickerTemplatePromise;
export const getColorPickerTemplateService = {
    dependencies: [],
    async: true,
    start() {
        return () => {
            colorPickerTemplatePromise ??= orm.call(
                'ir.ui.view',
                'render_public_asset',
                ['web_editor.colorpicker', {}]
            );
            return colorPickerTemplatePromise;
        };
    },
};

registry.category("services").add("get_color_picker_template", getColorPickerTemplateService);
