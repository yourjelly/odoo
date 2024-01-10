/** @odoo-module **/

import { Component } from "@odoo/owl";

export class ShareBar extends Component {
    static template = "social_share.ShareBar";

    get encodedUrl() {
        return encodeURIComponent(this.url);
    }
    get url() {
        return this.props.shareUrl;
    }
}
