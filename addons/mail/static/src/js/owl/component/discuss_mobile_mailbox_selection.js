odoo.define('mail.component.DiscussMobileMailboxSelection', function (require) {
'use strict';

const { Component, connect } = owl;

class MobileMailboxSelection extends Component {
    /**
     * @param  {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.component.DiscussMobileMailboxSelection';
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {mail.store.model.Thread} mailbox
     * @return {boolean}
     */
    active(mailbox) {
        return this.props.threadLocal === mailbox.localId;
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onClick(ev) {
        this.trigger('select-thread', ev, {
            threadLocalId: ev.currentTarget.dataset.mailboxLocalId,
        });
    }
}

/**
 * Props validation
 */
MobileMailboxSelection.props = {
    pinnedMailboxList: { type: Array, element: Object, /* {mail.store.model.Thread} */ },
    threadLocalId: { type: String, optional: true },
};

return connect(
    MobileMailboxSelection,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {Object} getters
     * @return {Object}
     */
    (state, ownProps, getters) => {
        return {
            pinnedMailboxList: getters.pinnedMailboxList(),
        };
    },
    { deep: false }
);

});
