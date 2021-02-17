/** @odoo-module **/

import { registerMessagingComponent } from '@mail/utils/messaging_component';

const { Component } = owl;

class LinkPreviewGif extends Component {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {LinkPreviewGifView}
     */
    get linkPreviewGifView() {
        return this.props.record;
    }

}

Object.assign(LinkPreviewGif, {
    props: { record: Object },
    template: 'mail.LinkPreviewGif',
});

registerMessagingComponent(LinkPreviewGif);
