odoo.define('mail.form_renderer', function (require) {
"use strict";

var Chatter = require('mail.Chatter');
var FormRenderer = require('web.FormRenderer');

/**
 * Include the FormRenderer to instanciate the chatter area containing (a
 * subset of) the mail widgets (mail_thread, mail_followers and mail_activity).
 */
FormRenderer.include({
    /**
     * @override
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.mailFields = params.mailFields;
        this.chatter = undefined;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Updates the chatter area with the new state if its fields has changed
     *
     * @override
     */
    confirmChange: function (state, id, fields) {
        if (this.chatter) {
            var chatterFields = ['message_attachment_count'].concat(_.values(this.mailFields));
            var updatedMailFields = _.intersection(fields, chatterFields);
            if (updatedMailFields.length) {
                this.chatter.update(state, updatedMailFields);
            }
        }
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Overrides the function that renders the nodes to process the 'oe_chatter'
     * div node: we instantiate (or update if it already exists) the chatter,
     * and we return a fake node that we will use as a hook to insert the
     * chatter into the DOM when the whole view will be rendered.
     *
     * @override
     * @private
     */
    _renderNode: function (node) {
        var self = this;
        if (node.tag === 'div' && node.attrs.class === 'oe_chatter') {
            if (!this.chatter) {
                this.chatter = new Chatter(this, this.state, this.mailFields, {
                    isEditable: this.activeActions.edit,
                    viewType: 'form',
                });
                this.defs.push(this.chatter.appendTo($('<div>')).then(function () {
                    self._handleAttributes(self.chatter.$el, node);
                }));
            } else {
                this.chatter.update(this.state);
            }
            return $('<div>', { class: 'oe_chatter', id: 'temp_chatter_hook' });
        } else {
            return this._super.apply(this, arguments);
        }
    },
    /**
     * @override
     */
    _updateView: function () {
        // detach the chatter before calling _super, as we'll empty the html,
        // which would remove all handlers on the chatter
        if (this.chatter) {
            this.chatter.$el.detach();
        }
        this._super(...arguments);
        // replace our hook by the chatter's el once the view has been updated
        if (this.chatter) {
            this.$('#temp_chatter_hook').replaceWith(this.chatter.$el);
        }
    },
});

});
