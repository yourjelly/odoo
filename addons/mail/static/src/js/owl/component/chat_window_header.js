odoo.define('mail.component.ChatWindowHeader', function (require) {
"use strict";

const Icon = require('mail.component.ThreadIcon');

const { Component, connect } = owl;

class ChatWindowHeader extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { Icon };
        this.id = `chat_window_header_${this.props.chatWindowId}`;
        this.template = 'mail.component.ChatWindowHeader';
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

    get name() {
        if (this.props.thread) {
            return this.props.threadName;
        }
        return this.env._t("New message");
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        this.trigger('clicked', {
            chatWindowId: this.props.chatWindowId,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickClose(ev) {
        this.trigger('close', {
            chatWindowId: this.props.chatWindowId,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickExpand(ev) {
        if (!this.props.thread) {
            return;
        }
        if (['mail.channel', 'mail.box'].includes(this.props.thread._model)) {
            this.env.do_action('mail.action_owl_discuss', {
                clear_breadcrumbs: false,
                active_id: this.props.thread.localId,
                on_reverse_breadcrumb: () =>
                    // ideally discuss should do it itself...
                    this.env.store.commit('closeDiscuss'),
            });
        } else {
            this.env.do_action({
                type: 'ir.actions.act_window',
                res_model: this.props.thread._model,
                views: [[false, 'form']],
                res_id: this.props.thread.id,
            });
        }
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickShiftLeft(ev) {
        this.trigger('shift-left', {
            chatWindowId: this.props.chatWindowId,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickShiftRight(ev) {
        this.trigger('shift-right', {
            chatWindowId: this.props.chatWindowId,
        });
    }
}

ChatWindowHeader.props = {
    chatWindowId: String,
    expand: Boolean,
    shiftLeft: Boolean,
    shiftRight: Boolean,
    thread: { type: Object, /* {mail.store.model.Thread} */ optional: true },
    threadName: { type: String, optional: true },
};

ChatWindowHeader.defaultProps = {
    expand: false,
    shiftLeft: false,
    shiftRight: false,
};

return connect(
    ChatWindowHeader,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.chatWindowId
     * @param {Object} state.getters
     * @return {Object}
     */
    (state, ownProps, getters) => {
        const chatWindowId = ownProps.chatWindowId;
        const thread = state.threads[chatWindowId];
        const threadName = thread
            ? getters.threadName(chatWindowId)
            : undefined;
        return {
            thread,
            threadName,
        };
    },
    { deep: false }
);

});
