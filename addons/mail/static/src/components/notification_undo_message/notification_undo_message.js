odoo.define('mail/static/src/components/notification_undo_message/notification_undo_message.js', function (require) {
    'use strict';

    const useStore = require('mail/static/src/component_hooks/use_store/use_store.js');
    const { Component } = owl;

    class NotificationUndoMessage extends Component {

        async _onClickUndo(ev) {
            const message = this.env.models['mail.message'].get(this.props.messageLocalId);
            message.undoMessage();
            this.destroy();
        }

        _onClickClose() {
            this.destroy();
        }

    }

    NotificationUndoMessage.props = {
        messageLocalId: String,
    };

    NotificationUndoMessage.template = 'mail.NotificationUndoMessage';

    return NotificationUndoMessage;
});
