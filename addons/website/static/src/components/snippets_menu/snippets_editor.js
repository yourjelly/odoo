/** @odoo-module **/

import { SnippetEditor } from "@web_editor/components/snippets_menu/snippets_editor";
import { useService } from "@web/core/utils/hooks";

export class WebsiteSnippetEditor extends SnippetEditor {
    /**
     * @override
     */
    setup() {
        super.setup();
        this.websiteService = useService("website");
    }
    willClone() {
        this.websiteService.websiteRootInstance.trigger_up("widgets_stop_request", {
            $target: $(this.target),
        });
    }
    /**
     * @override
     */
    willRemoveSnippet() {
        // TODO: Now that we have an overrided class, maybe we can just call it "stop_widget_request"?
        this.websiteService.websiteRootInstance.trigger_up("will_remove_snippet", {
            $target: $(this.target),
        });
        return super.willRemoveSnippet(...arguments);
    }
    didCloneSnippet(cloneEl) {
        return new Promise((resolve) => {
            this.websiteService.websiteRootInstance.trigger_up("snippet_cloned", {
                $target: $(this.target),
                $clone: $(cloneEl),
                onSuccess: resolve,
            });
        });
    }
}
