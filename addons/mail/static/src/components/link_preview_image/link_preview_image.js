/** @odoo-module **/

import { registerMessagingComponent } from '@mail/utils/messaging_component';

const { Component } = owl;

class LinkPreviewImage extends Component {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {LinkPreviewImageView}
     */
    get linkPreviewImageView() {
        return this.props.record;
    }

}

Object.assign(LinkPreviewImage, {
    props: { record: Object },
    template: 'mail.LinkPreviewImage',
});

registerMessagingComponent(LinkPreviewImage);
