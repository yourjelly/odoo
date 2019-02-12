odoo.define('mail.component.ThreadIcon', function (require) {
'use strict';

const { Component, connect } = owl;

class ThreadIcon extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.component.ThreadIcon';
    }
}

/**
 * Props validation
 */
ThreadIcon.props = {
    directPartner: { type: Object, /* {mail.store.model.Partner} */ optional: true },
    thread: Object, // {mail.store.model.Thread}
    threadLocalId: String,
};

return connect(
    ThreadIcon,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.threadLocalId
     * @return {Object}
     */
    (state, ownProps) => {
        const thread = state.threads[ownProps.threadLocalId];
        const directPartner = thread
            ? state.partners[thread.directPartnerLocalId]
            : undefined;
        return {
            directPartner,
            thread,
        };
    },
    { deep: false }
);

});
