/** @odoo-module **/

import { addFields, addRecordMethods, patchRecordMethods } from '@mail/model/model_core';
import { attr } from '@mail/model/model_field';
// ensure the model definition is loaded before the patch
import '@mail/models/channel_preview_view';

patchRecordMethods('ChannelPreviewView', {
    /**
     * @override
     */
    _computeIsEmpty() {
        return this.isRating || this._super();
    },
});

addRecordMethods('ChannelPreviewView', {});

addFields('ChannelPreviewView', {
    isRating: attr({
        compute() {
            return Boolean(this.thread.lastMessage && this.thread.lastMessage.rating);
        },
    }),
});
