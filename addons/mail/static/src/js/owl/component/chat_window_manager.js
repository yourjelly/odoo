odoo.define('mail.component.ChatWindowManager', function (require) {
"use strict";

const ChatWindow = require('mail.component.ChatWindow');
const HiddenMenu = require('mail.component.ChatWindowHiddenMenu');

const { Component, connect } = owl;

class ChatWindowManager extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.DEBUG = true;
        // owl
        this.components = { ChatWindow, HiddenMenu };
        this.template = 'mail.component.ChatWindowManager';
        // others
        this.TEXT_DIRECTION = this.env._t.database.parameters.direction;
        this._lastAutofocusedCounter = 0;
        this._lastAutofocusedChatWindowId = undefined;
        if (this.DEBUG) {
            window.chat_window_manager = this;
        }
    }

    mounted() {
        this._handleAutofocus();
    }

    patched() {
        this._handleAutofocus();
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

    /**
     * @return {string} either 'rtl' or 'ltr'
     */
    get direction() {
        if (this.TEXT_DIRECTION === 'rtl') {
            return 'ltr';
        } else {
            return 'rtl';
        }
    }

    /**
     * @return {Array}
     */
    get reverseVisible() {
        return [...this.props.computed.visible].reverse();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {integer} index
     * @return {boolean}
     */
    chatWindowShiftRight(index) {
        return index < this.props.computed.visible.length - 1;
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _handleAutofocus() {
        let handled = false;
        const cwm = this.env.store.state.chatWindowManager;
        const lastNotifiedAutofocusCounter = cwm.notifiedAutofocusCounter;
        if (
            !handled &&
            this.props.autofocusCounter === lastNotifiedAutofocusCounter
        ) {
            handled = true;
        }
        if (
            !handled &&
            this._lastAutofocusedChatWindowId === this.props.autofocusChatWindowId &&
            this._lastAutofocusedCounter === this.props.autofocusCounter
        ) {
            handled = true;
        }
        if (
            !handled &&
            this._lastAutofocusedChatWindowId === undefined
        ) {
            this.refs[this.props.autofocusChatWindowId].focus();
            handled = true;
        }
        if (
            !handled &&
            this._lastAutofocusedChatWindowId === this.props.autofocusChatWindowId &&
            this._lastAutofocusedCounter !== this.props.autofocusCounter
        ) {
            this.refs[this.props.autofocusChatWindowId].focus();
            handled = true;
        }
        if (
            !handled &&
            this._lastAutofocusedChatWindowId !== this.props.autofocusChatWindowId
        ) {
            this.refs[this.props.autofocusChatWindowId].focus();
            handled = true;
        }
        this._lastAutofocusedChatWindowId = this.props.autofocusChatWindowId;
        this._lastAutofocusedCounter = this.props.autofocusCounter;
        this.env.store.commit('updateChatWindowManager', {
            notifiedAutofocusCounter: this._lastAutofocusedCounter,
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.chatWindowId
     */
    _onCloseChatWindow(ev) {
        this.env.store.commit('closeChatWindow', ev.detail.chatWindowId);
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {integer} ev.detail.id
     * @param {string} ev.detail.model
     */
    async _onRedirect(ev) {
        const { id, model } = ev.detail;
        if (model === 'mail.channel') {
            ev.stopPropagation();
            const threadLocalId = `${model}_${id}`;
            const channel = this.env.store.state.threads[threadLocalId];
            if (!channel) {
                this.env.store.dispatch('joinChannel', id, {
                    autoselect: true,
                    chatWindowOpenMode: 'last_visible',
                });
                return;
            }
            this.env.store.commit('openChatWindow', threadLocalId);
            return;
        }
        if (model === 'res.partner') {
            if (id === this.env.session.partner_id) {
                this.env.do_action({
                    type: 'ir.actions.act_window',
                    res_model: 'res.partner',
                    views: [[false, 'form']],
                    res_id: id,
                });
                return;
            }
            const partnerLocalId = `res.partner_${id}`;
            let partner = this.env.store.state.partners[partnerLocalId];
            if (!partner) {
                this.env.store.commit('insertPartner', { id });
                partner = this.env.store.state.partners[partnerLocalId];
            }
            if (partner.userId === undefined) {
                // rpc to check that
                await this.env.store.dispatch('checkPartnerIsUser', partnerLocalId);
            }
            if (partner.userId === null) {
                // partner is not a user, open document instead
                this.env.do_action({
                    type: 'ir.actions.act_window',
                    res_model: 'res.partner',
                    views: [[false, 'form']],
                    res_id: partner.id,
                });
                return;
            }
            ev.stopPropagation();
            const chat = this.env.store.getters.chatFromPartner(`res.partner_${id}`);
            if (!chat) {
                this.env.store.dispatch('createChannel', {
                    autoselect: true,
                    chatWindowOpenMode: 'last_visible',
                    partnerId: id,
                    type: 'chat',
                });
                return;
            }
            this.env.store.commit('openChatWindow', chat.localId);
        }
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.chatWindowId
     */
    _onSelectChatWindow(ev) {
        this.env.store.commit('makeChatWindowVisible', ev.detail.chatWindowId);
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.chatWindowId
     * @param {string} ev.detail.threadLocalId
     */
    _onSelectThreadChatWindow(ev) {
        const { chatWindowId, threadLocalId } = ev.detail;
        if (!this.env.store.state.threads[threadLocalId].is_minimized) {
            this.env.store.commit('openChatWindow', threadLocalId);
        }
        this.env.store.commit('replaceChatWindow', chatWindowId, threadLocalId);
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.chatWindowId
     */
    _onShiftLeftChatWindow(ev) {
        this.env.store.commit('shiftLeftChatWindow', ev.detail.chatWindowId);
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.chatWindowId
     */
    _onShiftRightChatWindow(ev) {
        this.env.store.commit('shiftRightChatWindow', ev.detail.chatWindowId);
    }
}

/**
 * Props validation
 */
ChatWindowManager.props = {
    autofocusCounter: Number,
    autofocusChatWindowId: String,
    computed: {
        type: Object,
        shape: {
            availableVisibleSlots: Number,
            hidden: {
                type: Object,
                shape: {
                    chatWindowIds: { type: Array, element: String },
                    offset: Number,
                    showMenu: Boolean,
                },
            },
            visible: {
                type: Array,
                element: {
                    type: Object,
                    shape: {
                        chatWindowId: String,
                        offset: Number,
                    },
                },
            },
        },
    },
};

return connect(
    ChatWindowManager,
    /**
     * @param {Object} state
     * @return {Object}
     */
    state => {
        const {
            autofocusCounter,
            autofocusChatWindowId,
            computed,
        } = state.chatWindowManager;
        return {
            autofocusCounter,
            autofocusChatWindowId,
            computed,
        };
    },
    { deep: false }
);

});
