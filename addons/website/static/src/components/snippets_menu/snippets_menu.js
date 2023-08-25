/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { SnippetsMenu } from "@web_editor/components/snippets_menu/snippets_menu";


patch(SnippetsMenu.prototype, {
    setup() {
        super.setup();
        this._website = useService("website");
    },
    /**
     * @override
     */
    get invisibleSelector() {
        const isMobile = this._website.context.isMobile;
        const baseSelector = super.invisibleSelector;
        const selectors = [
            baseSelector,
            isMobile ? '.o_snippet_mobile_invisible' :
                '.o_snippet_desktop_invisible',
        ];

        if (this._website.context.translation) {
            // In translate mode, we do not want to be able to activate a
            // hidden header or footer.
            const exceptionSelector = ":not(header, footer)";
            selectors = selectors.map(selector => selector + exceptionSelector);
        }
        return selectors.join(",");
    }
});
