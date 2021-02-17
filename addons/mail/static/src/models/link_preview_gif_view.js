/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
import { insertAndReplace } from '@mail/model/model_field_command';

registerModel({
    name: 'LinkPreviewGifView',
    identifyingFields: ['linkPreview', 'linkPreviewListView'],
    fields: {
        linkPreview: one('LinkPreview', {
            inverse: 'linkPreviewGifView',
            readonly: true,
            required: true,
        }),
        linkPreviewAsideView: one('LinkPreviewAsideView', {
            default: insertAndReplace(),
            inverse: 'linkPreviewGifView',
            isCausal: true,
        }),
        linkPreviewListView: one('LinkPreviewListView', {
            inverse: 'linkPreviewAsGifViews',
            readonly: true,
            required: true,
        }),
    },
});
