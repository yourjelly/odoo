odoo.define('hr_expense.Attachment', function (require) {
"use static";

var Core = require('web.core');
var Widget = require('web.Widget');

var _t = Core._t;

var AttachDocument = Widget.extend({
    template: 'AttachDocument',
    events: {
        'click #o_attach_document': '_onClickAttachDocument',
        'change input.o_input_file': '_onFileChanged',
    },
    /**
     * @constructor
     * @param {Widget} parent
     * @param {Object} params
     */
    init: function (parent, params) {
        this._super.apply(this, arguments);
        this.res_id = params.state.res_id;
        this.res_model = params.state.model;
        this.node = params.node;
        this.state = params.state;
        this.fileuploadID = _.uniqueId('o_fileupload');
    },
    /**
     * @override
     */
    start: function () {
        var self = this;
        $(window).on(self.fileuploadID, self._onFileLoaded.bind(self));
        return this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    destroy: function () {
        this._super.apply(this, arguments);
        $(window).off(this.fileupload_id);
    },

    //--------------------------------------------------------------------------
    // private
    //--------------------------------------------------------------------------

    /**
     * Helper function to display a warning that some fields have an invalid
     * value. This is used when a save operation cannot be completed.
     *
     * @private
     * @param {string[]} invalidFields - list of field names
     */
    _notifyInvalidFields: function (invalidFields) {
        var fields = this.state.fields;
        var warnings = invalidFields.map(function (fieldName) {
            var fieldStr = fields[fieldName].string;
            return _.str.sprintf('<li>%s</li>', _.escape(fieldStr));
        });
        warnings.unshift('<ul>');
        warnings.push('</ul>');
        this.do_warn(_t("The following fields are invalid:"), warnings.join(''));
     },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onClickAttachDocument: function (ev) {
        // This widget uses a hidden form to upload files. Clicking on 'Attach'
        var fieldNames = this.getParent().canBeSaved(this.state.id);
        if (fieldNames.length) {
            this._notifyInvalidFields(fieldNames);
            return false;
        }
        if (!this.res_id) {
            this.do_warn(_t('Warning : You have to save record before attachment'));
            return ;
        }
        this.$('input.o_input_file').trigger('click');
    },
    /**
     * @private
     * @param {Event} ev
     */
    _onFileChanged: function (ev) {
        ev.stopPropagation();
        this.$('form.o_form_binary_form').trigger('submit');
    },
    /**
     * attachdocument log on chatter
     *
     * @private
     */
    _onFileLoaded: function () {
        var self = this;
        // the first argument isn't a file but the jQuery.Event
        var files = Array.prototype.slice.call(arguments, 1);
        return this._rpc({
            model: self.res_model,
            method: 'message_post',
            args: [self.res_id],
            kwargs: {
                'attachment_ids': _.map(files, function (file) {return file.id;}),
            }
        }).then( function (){
            // reload the form view
            self.trigger_up('reload');
        });
    },

});
Core.button_widgets_registry.add('attachment', AttachDocument);
});
