odoo.define('mail.component.ChatWindow', function (require) {
"use strict";

const AutocompleteInput = require('mail.component.AutocompleteInput');
const Header = require('mail.component.ChatWindowHeader');
const Thread = require('mail.component.Thread');

const { Component, connect } = owl;

class ChatWindow extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = { AutocompleteInput, Header, Thread };
        this.id = `chat_window_${this.props.chatWindowId}`;
        this.state = {
            focused: false,
            folded: false, // used for 'new_message' chat window
        };
        this.template = 'mail.component.ChatWindow';

        this._globalCaptureFocusEventListener = ev => this._onFocusCaptureGlobal(ev);
        this._globalMousedownEventListener = ev => this._onMousedownGlobal(ev);
        // bind since passed as props
        this._onAutocompleteSelect = this._onAutocompleteSelect.bind(this);
        this._onAutocompleteSource = this._onAutocompleteSource.bind(this);
    }

    mounted() {
        this._applyOffset();
        document.addEventListener('focus', this._globalCaptureFocusEventListener, true);
        document.addEventListener('mousedown', this._globalMousedownEventListener, false);
    }

    /**
     * @param {Object} nextProps
     * @param {string} [nextProps.chatWindowId]
     */
    willUpdateProps(nextProps) {
        const { chatWindowId=this.props.chatWindowId } = nextProps;
        this.id = `chat_window_${chatWindowId}`;
    }

    patched() {
        this._applyOffset();
    }

    willUnmount() {
        document.removeEventListener('focus', this._globalCaptureFocusEventListener, true);
        document.removeEventListener('mousedown', this._globalMousedownEventListener);
    }

    //--------------------------------------------------------------------------
    // Getter / Setter
    //--------------------------------------------------------------------------

    /**
     * @return {boolean}
     */
    get folded() {
        if (this.props.thread) {
            return this.props.thread.fold_state === 'folded';
        }
        return this.state.folded;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    focus() {
        this.state.focused = true;
        if (!this.props.thread) {
            this.refs.input.focus();
        } else {
            this.refs.thread.focus();
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _applyOffset() {
        const offsetFrom = this.props.direction === 'rtl' ? 'right' : 'left';
        const oppositeFrom = offsetFrom === 'right' ? 'left' : 'right';
        this.el.style[offsetFrom] = this.props.offset + 'px';
        this.el.style[oppositeFrom] = 'auto';
    }

    /**
     * @private
     */
    _close() {
        this.trigger('close', {
            chatWindowId: this.props.chatWindowId,
        });
    }

    /**
     * @private
     */
    _focusout() {
        this.state.focused = false;
        if (!this.props.thread) {
            this.refs.input.focusout();
        } else {
            this.refs.thread.focusout();
        }
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     * @param {Object} ui
     * @param {Object} ui.item
     * @param {integer} ui.item.id
     */
    _onAutocompleteSelect(ev, ui) {
        const partnerId = ui.item.id;
        const partnerLocalId = `res.partner_${partnerId}`;
        const chat = this.env.store.getters.chatFromPartner(partnerLocalId);
        if (chat) {
            this.trigger('select-thread', {
                chatWindowId: this.props.chatWindowId,
                threadLocalId: chat.localId,
            });
        } else {
            this._close();
            this.env.store.dispatch('createChannel', {
                autoselect: true,
                partnerId,
                type: 'chat'
            });
        }
    }

    /**
     * @private
     * @param {Object} req
     * @param {string} req.term
     * @param {function} res
     */
    _onAutocompleteSource(req, res) {
        return this.env.store.dispatch('searchPartners', {
            callback: (partners) => {
                const suggestions = partners.map(partner => {
                    return {
                        id: partner.id,
                        value: partner.displayName,
                        label: partner.displayName
                    };
                });
                res(_.sortBy(suggestions, 'label'));
            },
            keyword: _.escape(req.term),
            limit: 10,
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        if (!this.folded) {
            this.focus();
        } else {
            this._focusout();
        }
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onClickedHeader(ev) {
        if (!this.props.thread) {
            this.state.folded = !this.state.folded;
        } else {
            this.env.store.commit('toggleFoldThread', this.props.chatWindowId);
        }
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onCloseHeader(ev) {
        this._close();
    }

    /**
     * @private
     * @param {FocusEvent} ev
     */
    _onFocusCaptureGlobal(ev) {
        if (ev.target === this.el) {
            return;
        }
        if (ev.target.closest(`[data-id="${this.id}"]`)) {
            return;
        }
        this._focusout();
    }

    /**
     * @private
     * @param {FocusEvent} ev
     */
    _onFocusinThread(ev) {
        this.state.focused = true;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onMousedownGlobal(ev) {
        if (ev.target === this.el) {
            this.focus();
            return;
        }
        if (ev.target.closest(`[data-id="${this.id}"]`)) {
            this.focus();
            return;
        }
        this._focusout();
    }
}

/**
 * Props validation
 */
ChatWindow.props = {
    chatWindowId: String,
    direction: String,
    expand: Boolean,
    offset: Number,
    shiftLeft: Boolean,
    shiftRight: Boolean,
    thread: { type: Object, /* {mail.component.Thread} */ optional: true },
};

ChatWindow.defaultProps = {
    direction: 'rtl',
    expand: false,
    shiftLeft: false,
    shiftRight: false,
};

return connect(
    ChatWindow,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.chatWindowId
     * @return {Object}
     */
    (state, ownProps) => {
        return {
            thread: state.threads[ownProps.chatWindowId],
        };
    },
    { deep: false }
);

});
