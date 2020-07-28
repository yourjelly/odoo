odoo.define('web_editor.FormController', function (require) {
"use strict";
const FormController = require('web.FormController');

FormController.include({

    /**
     * @override
     */
    saveRecord: function () {
        return this._super(...arguments).then((changedFields) => {
            // update res_id with the actual record id for the Attachment, when record going to save
            // this will required for showing attachment under the media dialog
            // because of the attachment already created with res_id = 0
            const localData = this.model.get(this.handle);
            const wysiwygAttachmentsID = _.map(this.renderer.wysiwygAttachmentsID, (attachment) => {
                return attachment.id;
            });
            if (wysiwygAttachmentsID.length && localData.data.id){
                this._rpc({
                    model: 'ir.attachment',
                    method: 'write',
                    args: [wysiwygAttachmentsID, {
                        res_id: localData.data.id,
                    }],
                }).then((result) => {
                    return changedFields;
                });
            }
        });
    },
});
});
