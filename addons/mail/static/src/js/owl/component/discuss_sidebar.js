odoo.define('mail.component.DiscussSidebar', function (require) {
'use strict';

const AutocompleteInput = require('mail.component.AutocompleteInput');
const SidebarItem = require('mail.component.DiscussSidebarItem');

const { Component, connect } = owl;

class DiscussSidebar extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.components = {
            AutocompleteInput,
            SidebarItem
        };
        this.state = {
            isAddingChannel: false,
            isAddingChat: false,
            quickSearchValue: '',
        };
        this.template = 'mail.component.DiscussSidebar';
        this._channelAutocompleteLastSearchVal = undefined;

        // bind since passed as props
        this._onChannelAutocompleteSelect = this._onChannelAutocompleteSelect.bind(this);
        this._onChannelAutocompleteSource = this._onChannelAutocompleteSource.bind(this);
        this._onChatAutocompleteSelect = this._onChatAutocompleteSelect.bind(this);
        this._onChatAutocompleteSource = this._onChatAutocompleteSource.bind(this);
    }

    //--------------------------------------------------------------------------
    // Getters / Setters
    //--------------------------------------------------------------------------

    /**
     * @return {mail.store.model.Thread[]}
     */
    get quickSearchChannelList() {
        if (!this.state.quickSearchValue) {
            return this.props.pinnedChannelList;
        }
        const qsVal = this.state.quickSearchValue.toLowerCase();
        return this.props.pinnedChannelList.filter(channel => {
            const nameVal = this.env.store.getters.threadName(channel.localId).toLowerCase();
            return nameVal.indexOf(qsVal) !== -1;
        });
    }

    /**
     * @return {mail.store.model.Thread[]}
     */
    get quickSearchChatList() {
        if (!this.state.quickSearchValue) {
            return this.props.pinnedChatList;
        }
        const qsVal = this.state.quickSearchValue.toLowerCase();
        return this.props.pinnedChatList.filter(chat => {
            const nameVal = this.env.store.getters.threadName(chat.localId).toLowerCase();
            return nameVal.indexOf(qsVal) !== -1;
        });
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
     * @param {string} [ui.item.special]
     */
    _onChannelAutocompleteSelect(ev, ui) {
        if (!this._channelAutocompleteLastSearchVal) {
            return;
        }
        if (ui.item.special) {
            this.env.store.dispatch('createChannel', {
                name: this._channelAutocompleteLastSearchVal,
                public: ui.item.special,
                type: 'channel'
            });
        } else {
            this.env.store.dispatch('joinChannel', ui.item.id);
        }
        this.state.isAddingChannel = false;
    }

    /**
     * @private
     * @param {Object} req
     * @param {string} req.term
     * @param {function} res
     */
    async _onChannelAutocompleteSource(req, res) {
        this._channelAutocompleteLastSearchVal = _.escape(req.term);
        const result = await this.env.rpc({
            model: 'mail.channel',
            method: 'channel_search_to_join',
            args: [this._channelAutocompleteLastSearchVal],
        });
        const items = result.map(data => {
            let escapedName = _.escape(data.name);
            return Object.assign(data, {
                label: escapedName,
                value: escapedName
            });
        });
        items.push({
            label: this.env._t(
                `<strong>Create <em><span class="fa fa-hashtag"/>${
                    this._channelAutocompleteLastSearchVal
                }</em></strong>`
            ),
            value: this._channelAutocompleteLastSearchVal,
            special: 'public'
        }, {
            label: this.env._t(
                `<strong>Create <em><span class="fa fa-lock"/>${
                    this._channelAutocompleteLastSearchVal
                }</em></strong>`
            ),
            value: this._channelAutocompleteLastSearchVal,
            special: 'private'
        });
        res(items);
    }

    /**
     * @private
     * @param {Event} ev
     * @param {Object} ui
     * @param {Object} ui.item
     * @param {integer} ui.item.id
     */
    _onChatAutocompleteSelect(ev, ui) {
        const partnerId = ui.item.id;
        const chat = this.env.store.getters.chatFromPartner(`res.partner_${partnerId}`);
        if (chat) {
            this.trigger('select-thread', {
                threadLocalId: chat.localId,
            });
        } else {
            ev.stopPropagation();
            this.env.store.dispatch('createChannel', {
                autoselect: true,
                partnerId,
                type: 'chat'
            });
        }
        this.state.isAddingChat = false;
    }

    /**
     * @private
     * @param {Object} req
     * @param {string} req.term
     * @param {function} res
     */
    _onChatAutocompleteSource(req, res) {
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
    _onClickChannelAdd(ev) {
        this.state.isAddingChannel = true;
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickChannelTitle(ev) {
        return this.env.do_action({
            name: this.env._t("Public Channels"),
            type: 'ir.actions.act_window',
            res_model: 'mail.channel',
            views: [[false, 'kanban'], [false, 'form']],
            domain: [['public', '!=', 'private']]
        });
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClickChatAdd(ev) {
        this.state.isAddingChat = true;
    }

    /**
     * @private
     * @param {CustomEvent} ev
     * @param {Object} ev.detail
     * @param {string} ev.detail.threadLocalId
     */
    _onClickedItem(ev) {
        return this.trigger('select-thread', {
            threadLocalId: ev.detail.threadLocalId,
        });
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onHideAddChannel(ev) {
        this.state.isAddingChannel = false;
    }

    /**
     * @private
     * @param {CustomEvent} ev
     */
    _onHideAddChat(ev) {
        this.state.isAddingChat = false;
    }

    /**
     * @private
     * @param {KeyboardEvent} ev
     */
    _onInputQuickSearch(ev) {
        this.state.quickSearchValue = this.refs.quickSearch.value;
    }
}

/**
 * Props validation
 */
DiscussSidebar.props = {
    pinnedChannelList: { type: Array, element: Object, /* {mail.store.model.Thread} */ },
    pinnedChatList: { type: Array, element: Object, /* {mail.store.model.Thread} */ },
    pinnedMailboxList: { type: Array, element: Object, /* {mail.store.model.Thread} */ },
    pinnedMailChannelAmount: Number,
    threadLocalId: String,
};


return connect(
    DiscussSidebar,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {Object} getters
     * @return {Object}
     */
    (state, ownProps, getters) => {
        return {
            pinnedChannelList: getters.pinnedChannelList(),
            pinnedChatList: getters.pinnedChatList(),
            pinnedMailboxList: getters.pinnedMailboxList(),
            pinnedMailChannelAmount: getters.pinnedMailChannelAmount(),
        };
    },
    { deep: false }
);

});
