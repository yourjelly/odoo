odoo.define('hr_expense.FormRenderer', function (require) {
"use strict";

var FormRenderer = require('web.FormRenderer');

var AttachPhoto = require('hr_expense.AttachPhoto');


/**
 * Include the FormRenderer to instanciate widget AttachPhoto.
 * The method will be automatically called to replace the tag <attachphoto>.
 */
FormRenderer.include({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _renderTagAttachphoto: function () {
        var widget = new AttachPhoto(this, {
            res_id: this.state.res_id,
            res_model: this.state.model,
        });
        widget.appendTo($('<div>'));
        return widget;
    },
    /**
     * @private
     * @param {Object} node
     * @returns {jQueryElement}
     */
    _renderTagHeader: function (node) {
        var self = this,
            $statusbar = this._super.apply(this, arguments);
        _.each(node.children, function (child) {
            if (child.tag === 'attachphoto') {
                var widget = self._renderTagAttachphoto(child, self.state);
                var $statusbarButtons = $statusbar.find('.o_statusbar_buttons');
                $statusbarButtons.prepend(widget.$el);
            }
        });
        return $statusbar;
    },
});

});
