/* @odoo-module */

import { Model } from "./model";

export class LinkPreview extends Model {
    /** @type {number} */
    id;
    /** @type {Object} */
    message;
    /** @type {string} */
    image_mimetype;
    /** @type {string} */
    og_description;
    /** @type {string} */
    og_image;
    /** @type {string} */
    og_mimetype;
    /** @type {string} */
    og_title;
    /** @type {string} */
    og_type;
    /** @type {string} */
    source_url;

    /**
     * @param {Object} data
     * @returns {LinkPreview}
     */
    constructor(data) {
        super();
        this.assign(data, this.fields);
    }

    get imageUrl() {
        return this.og_image ? this.og_image : this.source_url;
    }

    get isImage() {
        return Boolean(this.image_mimetype || this.og_mimetype === "image/gif");
    }

    get isVideo() {
        return Boolean(!this.isImage && this.og_type && this.og_type.startsWith("video"));
    }

    get isCard() {
        return !this.isImage && !this.isVideo;
    }
}
