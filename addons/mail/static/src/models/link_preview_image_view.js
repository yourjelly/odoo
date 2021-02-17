/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
import { insertAndReplace } from '@mail/model/model_field_command';

registerModel({
    name: 'LinkPreviewImageView',
    identifyingFields: ['linkPreview', 'linkPreviewListView'],
    fields: {
        linkPreview: one('LinkPreview', {
            inverse: 'linkPreviewImageView',
            readonly: true,
            required: true,
        }),
        linkPreviewAsideView: one('LinkPreviewAsideView', {
            default: insertAndReplace(),
            inverse: 'linkPreviewImageView',
            isCausal: true,
        }),
        linkPreviewListView: one('LinkPreviewListView', {
            inverse: 'linkPreviewAsImageViews',
            readonly: true,
            required: true,
        }),
    }
});
