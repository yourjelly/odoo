/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { one, attr } from '@mail/model/model_field';
import { insertAndReplace } from '@mail/model/model_field_command';

registerModel({
    name: 'LinkPreviewVideoView',
    identifyingFields: ['linkPreview', 'linkPreviewListView'],
    recordMethods: {
        /**
         * @private
         * @returns {string}
         */
        _computeBackgroundStyle() {
            return `background-image: url('${this.linkPreview.image_url}')`;
        },
    },
    fields: {
        backgroundStyle: attr({
            compute: '_computeBackgroundStyle',
        }),
        linkPreview: one('LinkPreview', {
            inverse: 'linkPreviewVideoView',
            readonly: true,
            required: true,
        }),
        linkPreviewAsideView: one('LinkPreviewAsideView', {
            default: insertAndReplace(),
            inverse: 'linkPreviewVideoView',
            isCausal: true,
        }),
        linkPreviewListView: one('LinkPreviewListView', {
            inverse: 'linkPreviewAsVideoViews',
            readonly: true,
            required: true,
        }),
    },
});
