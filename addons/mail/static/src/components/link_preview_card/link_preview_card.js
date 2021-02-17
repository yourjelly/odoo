/** @odoo-module **/

import { registerMessagingComponent } from '@mail/utils/messaging_component';

const { Component } = owl;

class LinkPreviewCard extends Component {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {LinkPreviewCardView}
     */
    get linkPreviewCardView() {
        return this.props.record;
    }

}

Object.assign(LinkPreviewCard, {
    props: { record: Object },
    template: 'mail.LinkPreviewCard',
});

registerMessagingComponent(LinkPreviewCard);
