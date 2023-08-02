/** @odoo-module **/

import options from "@web_editor/js/editor/snippets.options";

options.registry.WebsiteControllerPageListingLayout = options.Class.extend({
    init() {
        this._super(...arguments);
        this.rpc = this.bindService("rpc");
    },

    /**
     * @override
     */
    willStart: async function () {
        const _super = this._super.bind(this);
        this.layout = await this.rpc("/website_studio/get_default_layout_mode", {
            view_id: this.$target[0].getAttribute("data-view-id"),
        });
        return _super(...arguments);
    },

    setLayout: async function (previewMode, widgetValue) {
        const params = {
            layout_mode: widgetValue,
            view_id: this.$target[0].getAttribute("data-view-id"),
        };
        // save the default layout display, and set the layout for the current user
        await Promise.all([
            this.rpc("/website_studio/save_default_layout_mode", params),
            this.rpc("/website/save_session_layout_mode", params),
        ]);
    },

    /**
    *
    * @param methodName
    * @param params
    * @returns {string|string|*}
    * @private
    */
   _computeWidgetState(methodName) {
        switch (methodName) {
            case 'setLayout': {
                return this.layout;
            }
        }
        return this._super(...arguments);
   },
});
