/** @odoo-module **/

import options from "@web_editor/js/editor/snippets.options";

options.registry.Alert = options.Class.extend({
    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Change alert's icon pictogram..
     *
     * @see this.selectClass for parameters
     */
    iconClass: function (previewMode, widgetValue, params) {
        const icon = this.$target.find('.s_alert_icon');

        if (!icon) { return; }

        params.possibleValues.forEach(val => {
            icon.toggleClass(val, val === widgetValue);
        });
    },
});
