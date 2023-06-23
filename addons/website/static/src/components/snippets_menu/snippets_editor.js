/** @odoo-module **/

import { SnippetEditor } from "@web_editor/components/snippets_menu/snippets_editor.js";
import { useService } from "@web/core/utils/hooks";

export class WebsiteSnippetEditor extends SnippetEditor {
    /**
     * @override
     */
    setup() {
        super.setup();
        this.websiteService = useService("website");
    }
    /**
     * @override
     */
    willRemoveSnippet() {
        // TODO: Now that we have an overrided class, maybe we can just call it "stop_widget_request"?
        this.websiteService.websiteRootInstance.trigger_up("will_remove_snippet", {$target: $(this.target.el)});
        return super.willRemoveSnippet(...arguments);
    }
}
