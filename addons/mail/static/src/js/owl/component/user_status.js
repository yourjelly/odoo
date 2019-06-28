odoo.define('mail.component.UserStatus', function (require) {
'use strict';

const { Component, connect } = owl;

class UserStatus extends Component {

    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.template = 'mail.component.UserStatus';
    }
}

return connect(
    UserStatus,
    /**
     * @param {Object} state
     * @param {Object} ownProps
     * @param {string} ownProps.authorLocalId
     * @return {Object}
     */
    (state, ownProps) => {
        return {
            author: state.partners[ownProps.authorLocalId],
        };
    },
    { deep: false });

});
