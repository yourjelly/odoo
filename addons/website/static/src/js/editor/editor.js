/** @odoo-module **/

import { LinkDialog } from "@web_editor/js/wysiwyg/widgets/link_dialog";
import { patch } from "@web/core/utils/patch";
import wUtils from "@website/js/utils";
import { onMounted, onWillUnmount, useEffect } from '@odoo/owl';
import { LinkTools } from "@web_editor/js/wysiwyg/widgets/link_tools";

patch(LinkDialog.prototype, {
    /**
     * Allows the URL input to propose existing website pages.
     *
     * @override
     */
    setup() {
        super.setup();
        useEffect(($link, container) => {
            const input = container?.querySelector(`input[name="url"]`);
            if (!input) {
                return;
            }
            const options = {
                body: $link && $link[0].ownerDocument.body,
                urlChosen: () => this.__onURLInput(),
            };
            const unmountAutocompleteWithPages = wUtils.autocompleteWithPages(input, options);
            return () => unmountAutocompleteWithPages();
        }, () => [this.$link, this.linkComponentWrapperRef.el]);
    }
});

patch(LinkTools.prototype, {
    /**
     * Allows the URL input to propose existing website pages.
     *
     * @override
     */
    async setup() {
        super.setup(...arguments);
        this.unmountAutocompleteWithPages = null;
        onMounted(() => {
            const input = this.$el?.get(0)?.querySelector(`input[name="url"]`);
            if (!input) {
                return;
            }
            const options = {
                body: this.$link && this.$link[0].ownerDocument.body,
                urlChosen: () => this.__onURLInput(),
            };
            this.unmountAutocompleteWithPages = wUtils.autocompleteWithPages(input, options);
        });
        onWillUnmount(() => {
            this.unmountAutocompleteWithPages?.();
        });
    },
});
