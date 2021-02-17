/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { many, one } from '@mail/model/model_field';
import { clear, insertAndReplace, replace } from '@mail/model/model_field_command';

registerModel({
    name: 'LinkPreviewListView',
    identifyingFields: [['composerView', 'messageView']],
    recordMethods: {
        /**
         * @private
         * @returns {FieldCommand}
         */
        _computeLinkPreviews() {
            if (this.composerView) {
                return replace(this.composerView.composer.linkPreviews);
            }
            if (this.messageView) {
                return replace(this.messageView.message.linkPreviews);
            }
            return clear();
        },
        /**
         * @private
         * @returns {FieldCommand}
         */
        _computeLinkPreviewAsCardViews() {
            return insertAndReplace(
                this.linkPreviews
                    .filter(linkPreview => linkPreview.isCard)
                    .map(linkPreview => ({ linkPreview: replace(linkPreview) }))
            );
        },
        /**
         * @private
         * @returns {FieldCommand}
         */
        _computeLinkPreviewAsGifViews() {
            return insertAndReplace(
                this.linkPreviews
                    .filter(linkPreview => linkPreview.isGif)
                    .map(linkPreview => ({ linkPreview: replace(linkPreview) }))
            );
        },
        /**
         * @private
         * @returns {FieldCommand}
         */
        _computeLinkPreviewAsImageViews() {
            return insertAndReplace(
                this.linkPreviews
                    .filter(linkPreview => linkPreview.isImage)
                    .map(linkPreview => ({ linkPreview: replace(linkPreview) }))
            );
        },
        /**
         * @private
         * @returns {FieldCommand}
         */
        _computeLinkPreviewAsVideoViews() {
            return insertAndReplace(
                this.linkPreviews
                    .filter(linkPreview => linkPreview.isVideo)
                    .map(linkPreview => ({ linkPreview: replace(linkPreview) }))
            );
        },
    },
    fields: {
        composerView: one('ComposerView', {
            inverse: 'linkPreviewListView',
            readonly: true,
        }),
        linkPreviews: many('LinkPreview', {
            compute: '_computeLinkPreviews',
        }),
        linkPreviewAsCardViews: many('LinkPreviewCardView', {
            compute: '_computeLinkPreviewAsCardViews',
            inverse: 'linkPreviewListView',
            isCausal: true,
        }),
        linkPreviewAsGifViews: many('LinkPreviewGifView', {
            compute: '_computeLinkPreviewAsGifViews',
            inverse: 'linkPreviewListView',
            isCausal: true,
        }),
        linkPreviewAsImageViews: many('LinkPreviewImageView', {
            compute: '_computeLinkPreviewAsImageViews',
            inverse: 'linkPreviewListView',
            isCausal: true,
        }),
        linkPreviewAsVideoViews: many('LinkPreviewVideoView', {
            compute: '_computeLinkPreviewAsVideoViews',
            inverse: 'linkPreviewListView',
            isCausal: true,
        }),
        messageView: one('MessageView', {
            inverse: 'linkPreviewListView',
            readonly: true,
        }),
    },
});
