/** @odoo-module **/

import { registerModel } from '@mail/model/model_core';
import { attr, many, one } from '@mail/model/model_field';

registerModel({
    name: 'LinkPreview',
    identifyingFields: ['id'],
    recordMethods: {
        async remove() {
            if (this.composer) {
                this.composer.linkPreviewsRemovedUrls.push(this.url);
                this.composer.update({ linkPreviewsRemovedUrls: this.composer.linkPreviewsRemovedUrls });
            }
            await this.messaging.rpc({
                route: '/mail/link_preview/delete',
                params: { link_preview_id: this.id },
            }, { shadow: true });
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeIsDeletable() {
            if (!this.messaging) {
                return false;
            }
            if (!this.message) {
                return true;
            }
            return this.message.canBeDeleted ||
                (this.message.author && this.message.author === this.messaging.currentPartner) ||
                (this.message.guestAuthor && this.message.guestAuthor === this.messaging.currentGuest);
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeIsGif() {
            return this.mimetype === 'image/gif';
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeIsImage() {
            return this.type === 'image' && !this.isGif;
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeIsVideo() {
            const type = this.type.split('.');
            return type.includes('video') && !this.isGif;
        },
        /**
         * @private
         * @returns {boolean}
         */
        _computeIsCard() {
            return !this.isVideo && !this.isGif && !this.isImage;
        }
    },
    fields: {
        composer: one('Composer', {
            inverse: 'linkPreviews',
        }),
        description: attr(),
        id: attr({
            required: true,
            readonly: true,
        }),
        image_url: attr(),
        isCard: attr({
            compute: '_computeIsCard',
        }),
        isDeletable: attr({
            compute: '_computeIsDeletable',
        }),
        isGif: attr({
            compute: '_computeIsGif',
        }),
        isImage: attr({
            compute: '_computeIsImage',
        }),
        isVideo: attr({
            compute: '_computeIsVideo',
        }),
        linkPreviewCardView: many('LinkPreviewCardView', {
            inverse: 'linkPreview',
            isCausal: true,
        }),
        linkPreviewGifView: many('LinkPreviewGifView', {
            inverse: 'linkPreview',
            isCausal: true,
        }),
        linkPreviewImageView: many('LinkPreviewImageView', {
            inverse: 'linkPreview',
            isCausal: true,
        }),
        linkPreviewVideoView: many('LinkPreviewVideoView', {
            inverse: 'linkPreview',
            isCausal: true,
        }),
        message: one('Message', {
            inverse: 'linkPreviews',
        }),
        mimetype: attr(),
        title: attr(),
        type: attr(),
        url: attr(),
    },
});
