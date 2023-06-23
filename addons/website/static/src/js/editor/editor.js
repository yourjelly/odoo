/** @odoo-module **/

import weWidgets from "@web_editor/js/wysiwyg/widget";
import wUtils from "@website/js/utils";

weWidgets.LinkDialog.include({
    /**
     * Allows the URL input to propose existing website pages.
     *
     * @override
     */
    start: async function () {
        const options = {
            body: this.linkWidget.$link && this.linkWidget.$link[0].ownerDocument.body,
        };
        const result = await this._super.apply(this, arguments);
        wUtils.autocompleteWithPages(this, this.$('input[name="url"]'), options);
        return result;
    },
});
