/** @odoo-module **/

import Widget from "@web/legacy/js/core/widget";
import config from "@web/legacy/js/services/config";

const Toolbar = Widget.extend({
    /**
     * @constructor
     * @param {Widget} parent
     * @param {string} contents
     */
    init: function (parent, template = 'web_editor.toolbar') {
        this._super.apply(this, arguments);
        this.template = template;
    },
    /**
     * States whether the current environment is in mobile or not. This is
     * useful in order to customize the template rendering for mobile view.
     *
     * @returns {boolean}
     */
    isMobile() {
        return config.device.isMobile;
    },
});

export default Toolbar;
