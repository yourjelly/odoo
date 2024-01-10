/** @odoo-module **/

import options from "@web_editor/js/editor/snippets.options";

options.registry.SocialShare = options.Class.extend({
    async setSocialSharePost(previewMode, widgetValue, params) {
        this.$target[0].dataset.socialSharePost = widgetValue;
        console.log("HHM")
    },

    /**
     * @override
     */
    _computeWidgetState(methodName, params) {
        console.log(methodName)
        switch (methodName) {
            case 'setSocialSharePost': {
                return this.$target[0].dataset.socialSharePost || '';
            }
        }
        return this._super(...arguments);
    },
});
