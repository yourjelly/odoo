/** @odoo-module **/

import { registerMessagingComponent } from '@mail/utils/messaging_component';

const { Component } = owl;

class LinkPreviewVideo extends Component {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {LinkPreviewVideoView}
     */
    get linkPreviewVideoView() {
        return this.props.record;
    }

}

Object.assign(LinkPreviewVideo, {
    props: { record: Object },
    template: 'mail.LinkPreviewVideo',
});

registerMessagingComponent(LinkPreviewVideo);
