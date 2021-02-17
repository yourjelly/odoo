/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
import { insertAndReplace } from '@mail/model/model_field_command';

registerModel({
    name: 'LinkPreviewCardView',
    identifyingFields: ['linkPreview', 'linkPreviewListView'],
    fields: {
        linkPreview: one('LinkPreview', {
            inverse: 'linkPreviewCardView',
            readonly: true,
            required: true,
        }),
        linkPreviewAsideView: one('LinkPreviewAsideView', {
            default: insertAndReplace(),
            inverse: 'linkPreviewCardView',
            isCausal: true,
        }),
        linkPreviewListView: one('LinkPreviewListView', {
            inverse: 'linkPreviewAsCardViews',
            readonly: true,
            required: true,
        }),
    },
});
