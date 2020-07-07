odoo.define('mail/static/src/components/notification_undo_message/notification_undo_message.js', function (require) {
    'use strict';

    const { Component } = owl;

    class NotificationUndoMessage extends Component {


    }

    NotificationUndoMessage.props = {
        messageLocalId: String,
    };

    NotificationUndoMessage.template = 'mail.NotificationUndoMessage';

    return NotificationUndoMessage;
});
