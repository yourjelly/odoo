/** @odoo-module **/

import { useMessagingContainer } from '@mail/component_hooks/use_messaging_container';

import { Component } from '@odoo/owl';

export class MessagingMenuContainer extends Component {

    /**
     * @override
     */
    setup() {
        useMessagingContainer();
    }

    get messaging() {
        return this.env.services.messaging.modelManager.messaging;
    }
}
MessagingMenuContainer.props = {};

Object.assign(MessagingMenuContainer, {
    template: 'mail.MessagingMenuContainer',
});
