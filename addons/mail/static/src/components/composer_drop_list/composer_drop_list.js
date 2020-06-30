odoo.define('mail/static/src/components/composer_drop_list/composer_drop_list.js', function (require) {
'use strict';

const useStore = require('mail/static/src/component_hooks/use_store/use_store.js');

const components = {
    ComposerDropListSuggestion: require('mail/static/src/components/composer_drop_list_suggestion/composer_drop_list_suggestion.js'),
};

const { Component } = owl;

class ComposerDropList extends Component {

    /**
     * @override
     */
    constructor(...args) {
        super(...args);
        useStore(props => {
            const composer = this.env.models['mail.composer'].get(props.composerLocalId);
            const activeSuggestedRecord = composer[composer.activeSuggestedRecordName] ? composer[composer.activeSuggestedRecordName] : undefined;
            const extraSuggestedRecordsList = composer[composer.extraSuggestedRecordsListName] ? composer[composer.extraSuggestedRecordsListName] : [];
            const mainSuggestedRecordsList = composer[composer.mainSuggestedRecordsListName] ? composer[composer.mainSuggestedRecordsListName] : [];
            return {
                activeSuggestedRecord: activeSuggestedRecord ? activeSuggestedRecord.__state : undefined,
                composer: composer ? composer.__state : undefined,
                extraSuggestedRecordsList: extraSuggestedRecordsList ? extraSuggestedRecordsList : [],
                mainSuggestedRecordsList: mainSuggestedRecordsList ? mainSuggestedRecordsList : [],
            };
        });
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {mail.model}
     */
    get activeSuggestedRecord() {
        return this.composer[this.composer.activeSuggestedRecordName];
    }

    /**
     * @returns {mail.composer}
     */
    get composer() {
        return this.env.models['mail.composer'].get(this.props.composerLocalId);
    }

    /**
     * @returns {mail.model[]}
    */
    get extraSuggestedRecordsList() {
        return this.composer.extraSuggestedRecordsListName ? this.composer[this.composer.extraSuggestedRecordsListName] : [];
    }

    /**
     * @returns {mail.model[]}
    */
    get mainSuggestedRecordsList() {
        return this.composer.mainSuggestedRecordsListName ? this.composer[this.composer.mainSuggestedRecordsListName] : [];
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} ev
     */
    _onSuggestionClicked(ev) {
        this.composer.insertSuggestion(ev.detail.record);
        this.composer.closeSuggestions();
        this.trigger('o-composer-suggestion-clicked');
    }

    /**
     * @private
     * @param {MouseEvent} ev
     */
    _onSuggestionMouseOver(ev) {
        this.composer.update({
            [this.composer.activeSuggestedRecordName]: [['link', ev.detail.record]],
        });
    }

}

Object.assign(ComposerDropList, {
    components,
    defaultProps: {
        isBelow: false,
    },
    props: {
        composerLocalId: String,
        isBelow: Boolean,
    },
    template: 'mail.ComposerDropList',
});

return ComposerDropList;

});
