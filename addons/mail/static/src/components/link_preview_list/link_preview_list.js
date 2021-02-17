/** @odoo-module **/

import { registerMessagingComponent } from '@mail/utils/messaging_component';

const { Component } = owl;

class LinkPreviewList extends Component {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {LinkPreviewListView}
     */
    get linkPreviewListView() {
        return this.props.record;
    }

}

Object.assign(LinkPreviewList, {
    props: { record: Object },
    template: 'mail.LinkPreviewList',
});

registerMessagingComponent(LinkPreviewList);
