import { registry } from "@web/core/registry";
import { SelectTemplate } from "@web_editor/js/editor/snippets.options";

export class MasonryLayout extends SelectTemplate {
    constructor() {
        super(...arguments);
        this.containerSelector = '> .container, > .container-fluid, > .o_container_small';
        this.selectTemplateWidgetName = 'masonry_template_opt';
    }
}

registry.category("snippet_options").add("MassMailingMasonryLayout", {
    module: "mass_mailing",
    Class: MasonryLayout,
    template: "mass_mailing.s_masonry_block_options",
    selector: ".s_masonry_block",
}, {
    sequence: 10,
});
