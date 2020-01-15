odoo.define('web.ControllerAdapterMixin', function (require) {
"use strict";

const { WidgetAdapterMixin } = require('web.OwlCompatibility');

const ControllerAdapterMixin = _.extend({}, WidgetAdapterMixin, {
    /**
     * @param {Object} props
     * @returns {Promise}
     */
    updateRendererState: function (props) {
        return this.renderer.update(props);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @returns {Promise}
     */
    _startRenderer: function () {
        return this.renderer.mount(this.$('.o_content')[0]);
    },
});

return ControllerAdapterMixin;

});
