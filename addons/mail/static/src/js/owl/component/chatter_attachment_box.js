odoo.define('mail.component.AttachmentBox', function (require) {
'use strict';

const AttachmentList = require('mail.component.AttachmentList');

const { Component, connect } = owl;

class AttachmentBox extends Component {
    // events: {
    //     "click .o_upload_attachments_button": "_onUploadAttachments",
    //     "change .o_chatter_attachment_form .o_form_binary_form": "_onAddAttachment",
    // },
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);

        this.template = 'mail.component.AttachmentBox';
        this.components = { AttachmentList };

        this.fileuploadId = _.uniqueId('oe_fileupload');
        $(window).on(this.fileuploadId, this._onUploaded.bind(this));
    }

    mounted() {
        this.env.store.dispatch('fetchDocumentAttachments', {
            resId: this.props.resId,
            resModel: this.props.resModel,
        });
    }

    willUnmount() {
        $(window).off(this.fileuploadId);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    // /**
    //  * Opens File Explorer dialog if all fields are valid and record is saved
    //  *
    //  * @private
    //  */
    // _onUploadAttachments() {
    //     this.$('input.o_input_file').click();
    // }
    // /**
    //  * @private
    //  */
    _onUploaded() {
    //     this.trigger_up('reload_attachment_box');
    }
}

return connect(
    AttachmentBox,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {integer} ownProps.resId
     * @param {string} ownProps.resModel
     * @param {Object} getters
     * @return {Object}
     */
    (state, ownProps, getters) => {
        return {
            imageAttachmentLocalIds: getters.imageAttachments({
                resId: ownProps.resId,
                resModel: ownProps.resModel,
            }).map(att => att.localId),
            nonImageAttachmentLocalIds: getters.nonImageAttachments({
                resId: ownProps.resId,
                resModel: ownProps.resModel,
            }).map(att => att.localId),
        };
    },
    { deep: false }
);

});
