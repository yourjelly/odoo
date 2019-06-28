odoo.define('mail.component.Discuss', function (require) {
'use strict';

const Composer = require('mail.component.Composer');
const MobileMailboxSelection = require('mail.component.DiscussMobileMailboxSelection');
const MobileNavbar = require('mail.component.DiscussMobileNavbar');
const Sidebar = require('mail.component.DiscussSidebar');
const Thread = require('mail.component.Thread');
const ThreadPreviewList = require('mail.component.ThreadPreviewList');

const { Component, Observer, connect } = owl;

class Discuss extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.DEBUG = true;
        this.components = {
            Composer,
            MobileMailboxSelection,
            MobileNavbar,
            Sidebar,
            Thread,
            ThreadPreviewList,
        };
        this.state = {
            mobileNavbarTab: 'mailbox',
            replyComposerToggled: false,
            replyMessageLocalId: null,
            replyThreadLocalId: null,
            threadCachesInfo: {},
        };
        this.template = 'mail.component.Discuss';
        /**
         * Last rendering "isMobile" status. Used to notify widget discuss
         * in case it changes, in order to update control panel.
         */
        this._wasMobile = undefined;

        if (this.DEBUG) {
            window.discuss = this;
        }
    }

    mounted() {
        if (this.props.threadLocalId !== this.env.discuss.initThreadLocalId) {
            this.trigger('push_state_action_manager', {
                threadLocalId: this.env.discuss.initThreadLocalId,
            });
        }
        this.env.store.commit('updateDiscuss', {
            domain: [],
            isOpen: true,
            threadLocalId: this.env.discuss.initThreadLocalId,
        });
        this._wasMobile = this.props.isMobile;
    }

    /**
     * @param {Object} nextProps
     * @param {Object} [nextProps.thread]
     */
    willUpdateProps(nextProps) {
        const thread = this.props.thread;
        if (!thread) {
            return;
        }
        const nextThread = nextProps.thread;
        if (!nextThread) {
            return;
        }
        if (thread.localId !== nextThread.localId) {
            return;
        }
        if (thread.localId !== 'mail.box_inbox') {
            return;
        }
        if (nextProps.threadCounter === 0 && this.props.threadCounter > 0) {
            this.trigger('show_rainbow_man');
        }
    }

    patched() {
        if (this._wasMobile !== this.props.isMobile) {
            this._wasMobile = this.props.isMobile;
            if (this.props.isMobile) {
                // adapt active mobile navbar tab based on thread in desktop
                this.state.mobileNavbarTab = !this.props.thread ? this.state.mobileNavbarTab
                    : this.props.thread._model === 'mail.box' ? 'mailbox'
                    : this.props.thread.channel_type === 'channel' ? 'channel'
                    : this.props.thread.channel_type === 'chat' ? 'chat'
                    : this.state.mobileNavbarTab;
            }
        }
        this.trigger('update_control_panel');
    }

    willUnmount() {
        this.env.store.commit('closeDiscuss');
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {boolean}
     */
    get hasThreadMessages() {
        if (!this.props.threadCache) {
            return false;
        }
        return this.props.threadCache.messageLocalIds.length > 0;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Array} domain
     */
    updateDomain(domain) {
        this.env.store.commit('updateDiscuss', { domain });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onComposerDiscarded() {
        this.state.replyComposerToggled = false;
        this.state.replyMessageLocalId = null;
        this.state.replyThreadLocalId = null;
    }

    /**
     * @private
     * @param {Event} ev
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
                });
                return;
            }
            this.env.store.commit('updateDiscuss', { threadLocalId });
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
            const partner = this.env.store.state.partners[partnerLocalId];
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
                    partnerId: id,
                    type: 'chat',
                });
                return;
            }
            this.env.store.commit('updateDiscuss', { threadLocalId: chat.localId });
        }
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.tab
     */
    _onSelectMobileNavbarTab(ev) {
        const { tab } = ev.detail;
        if (this.state.mobileNavbarTab === tab) {
            return;
        }
        this.env.store.commit('updateDiscuss', {
            threadLocalId: tab === 'mailbox' ? 'mail.box_inbox' : null,
        });
        this.state.mobileNavbarTab = tab;
        this.trigger('update_control_panel');
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.threadLocalId
     */
    _onSelectThread(ev) {
        if (this.refs.thread && this.refs.thread.hasMessages) {
            Observer.set(this.state.threadCachesInfo, this.props.threadCacheLocalId, {
                scrollTop: this.refs.thread.getScrollTop(),
            });
        }
        const { threadLocalId } = ev.detail;
        this.env.store.commit('updateDiscuss', { threadLocalId });
        this.trigger('push_state_action_manager', {
            threadLocalId,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.messageLocalId
     */
    _onReplyMessage(ev) {
        const { messageLocalId } = ev.detail;
        this.state.replyComposerToggled = true;
        this.state.replyMessageLocalId = messageLocalId;
        this.state.replyThreadLocalId = this.env.store.state.messages[messageLocalId].originThreadLocalId;
    }
    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onThreadRendered(ev) {
        this.trigger('update_control_panel');
    }
}

/**
 * Props validation
 */
Discuss.props = {
    domain: Array,
    isMobile: Boolean,
    thread: { type: Object, /* {mail.store.model.Thread} */ optional: true },
    threadCache: { type: Object, /* {mail.store.model.ThreadCache} */ optional: true },
    threadCacheLocalId: String,
    threadLocalId: String,
};

Discuss.defaultProps = {
    domain: [],
};

return connect(
    Discuss,
    /**
     * @param {Object} state
     * @return {Object}
     */
    state => {
        const {
            stringifiedDomain,
            threadLocalId,
        } = state.discuss;
        const thread = state.threads[threadLocalId];
        const threadCacheLocalId = `${threadLocalId}_${stringifiedDomain}`;
        const threadCache = state.threadCaches[threadCacheLocalId];
        return {
            ...state.discuss,
            isMobile: state.isMobile,
            thread,
            threadCache,
            threadCacheLocalId,
            // intentionally keep unsynchronize value of old thread counter
            // useful in willUpdateProps to detect change of counter
            threadCounter: thread && thread.counter,
        };
    },
    { deep: false }
);

});
