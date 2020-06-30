odoo.define('mail/static/src/components/composer_drop_list_suggestion/composer_drop_list_suggestion.js', function (require) {
'use strict';

const useStore = require('mail/static/src/component_hooks/use_store/use_store.js');

const components = {
    PartnerImStatusIcon: require('mail/static/src/components/partner_im_status_icon/partner_im_status_icon.js'),
};

const { Component } = owl;

class ComposerDropListSuggestion extends Component {

    /**
     * @override
     */
    constructor(...args) {
        super(...args);
        useStore(props => {
            const record = this.env.models[props.modelName].get(props.recordLocalId);
            return {
               record: record ? record.__state : undefined,
            };
        });
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    get isCannedResponse() {
        return this.props.modelName === "mail.canned_response";
    }

    get isChannel() {
        return this.props.modelName === "mail.thread";
    }

    get isCommand() {
        return this.props.modelName === "mail.command";
    }

    get isPartner() {
        return this.props.modelName === "mail.partner";
    }

    get record() {
        return this.env.models[this.props.modelName].get(this.props.recordLocalId);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onClick(ev) {
        ev.preventDefault();
        this.trigger('o-suggestion-clicked', {
            record: this.record,
        });
    }

    /**
     * @private
     * @param {Event} ev
     */
    _onMouseOver(ev) {
        this.trigger('o-suggestion-mouse-over', {
            record: this.record,
        });
    }

}

Object.assign(ComposerDropListSuggestion, {
    components,
    defaultProps: {
        isActive: false,
    },
    props: {
        isActive: Boolean,
        modelName: String,
        recordLocalId: String,
    },
    template: 'mail.ComposerDropListSuggestion',
});

return ComposerDropListSuggestion;

});
