/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { attr, one } from '@mail/model/model_field';
import { clear, insertAndReplace, replace } from '@mail/model/model_field_command';

registerModel({
    name: 'LinkPreviewAsideView',
    identifyingFields: [['linkPreviewCardView', 'linkPreviewImageView', 'linkPreviewGifView', 'linkPreviewVideoView']],
    recordMethods: {
        /**
         * Handles the click on delete link preview and open the confirm dialog.
         */
        onClickUnlink() {
            if (!this.linkPreview || !this.linkPreview.isDeletable) {
                return;
            }
            this.update({ linkPreviewDeleteConfirmDialog: insertAndReplace() });
        },
        /**
         * Handles mouse enter event for the container of this element.
         */
        onMouseEnterParent() {
            this.update({ toggleDisplayClose: true });
        },
        /**
         * Handles mouse leave event for the container of this element.
         */
        onMouseLeaveParent() {
            this.update({ toggleDisplayClose: false });
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeDisplayClose() {
            if (this.messaging.device.isMobileDevice) {
                return true;
            }
            return this.toggleDisplayClose;
        },
        /**
         * @private
         * @returns {FieldCommand}
         */
        _computeLinkPreview() {
            if (this.linkPreviewCardView) {
                return replace(this.linkPreviewCardView.linkPreview);
            }
            if (this.linkPreviewImageView) {
                return replace(this.linkPreviewImageView.linkPreview);
            }
            if (this.linkPreviewGifView) {
                return replace(this.linkPreviewGifView.linkPreview);
            }
            if (this.linkPreviewVideoView) {
                return replace(this.linkPreviewVideoView.linkPreview);
            }
            return clear();
        }
    },
    fields: {
        linkPreview: one('LinkPreview', {
            compute: '_computeLinkPreview',
        }),
        linkPreviewCardView: one('LinkPreviewCardView', {
            inverse: 'linkPreviewAsideView',
            readonly: true,
        }),
        linkPreviewDeleteConfirmDialog: one('Dialog', {
            inverse: 'linkPreviewOwnerAsLinkPreviewDeleteConfirm',
            isCausal: true,
        }),
        linkPreviewGifView: one('LinkPreviewGifView', {
            inverse: 'linkPreviewAsideView',
            readonly: true,
        }),
        linkPreviewImageView: one('LinkPreviewImageView', {
            inverse: 'linkPreviewAsideView',
            readonly: true,
        }),
        linkPreviewVideoView: one('LinkPreviewVideoView', {
            inverse: 'linkPreviewAsideView',
            readonly: true,
        }),
        toggleDisplayClose: attr({
            default: false,
        }),
        displayClose: attr({
            compute: '_computeDisplayClose',
        }),
    },
});
