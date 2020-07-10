odoo.define('mail/static/src/components/notification_undo_message/notification_undo_message.js', function (require) {
    'use strict';

    const useStore = require('mail/static/src/component_hooks/use_store/use_store.js');
    const { Component } = owl;

    class NotificationUndoMessage extends Component {

        constructor(...args) {
            super(...args);

            this.message = this.env.models['mail.message'].get(this.props.messageLocalId);
        }

        //--------------------------------------------------------------------------
        // Getters
        //--------------------------------------------------------------------------

        get messageInDiscuss() {
            return this.message.originThread.model === 'mail.channel' || this.message.originThread.composer.discussAsReplying;
        }

        get threadName() {
            return this.message.originThread.composer.discussAsReplying ? this.message.originThread.name : '';
        }
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
            await this.message.undoMessage();
            this.destroy();
        }

        _onClickClose(ev) {
            this.destroy();
        }

    }

    NotificationUndoMessage.props = {
        messageLocalId: String,
    };

    NotificationUndoMessage.template = 'mail.NotificationUndoMessage';

    return NotificationUndoMessage;
});
