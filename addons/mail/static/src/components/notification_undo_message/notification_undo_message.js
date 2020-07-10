odoo.define('mail/static/src/components/notification_undo_message/notification_undo_message.js', function (require) {
    'use strict';

    const useStore = require('mail/static/src/component_hooks/use_store/use_store.js');
    const { Component } = owl;

    class NotificationUndoMessage extends Component {

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Undo a sent message from chatter.
         *
         * @private
         * @param {MouseEvent} ev
         */
        async _onClickUndo(ev) {
            const message = this.env.models['mail.message'].get(this.props.messageLocalId);
            await message.undoMessage();
            this.destroy();
        }

        _onClickClose(ev) {
            this.destroy();
        }

        get threadName() {
            return this.props.threadName;
        }

    }

    NotificationUndoMessage.props = {
        messageLocalId: String,
        threadName: String,
    };

    NotificationUndoMessage.template = 'mail.NotificationUndoMessage';

    return NotificationUndoMessage;
});
