/** @odoo-module **/
"use strict";

import Dialog from 'web.Dialog';
import { _t } from 'web.core';

const KnowledgeArticleLinkModal = Dialog.extend({
    template: 'knowledge.wysiwyg_article_link_modal',
    /**
     * @override
     * @param {Widget} parent
     * @param {Object} options
     */
    init: function (parent, options) {
        // Set default options:
        options.title = options.title || _t('Choose an Article');
        options.buttons = options.buttons || [{
            text: _t('Ok'),
            classes: 'btn-primary',
            click: this._onConfirmButtonClick,
        }, {
            text: _t('Cancel'),
            close: true
        }];
        this._super(...arguments);
    },

    /**
     * @override
     * @returns {Promise}
     */
    start: function () {
        return this._super.apply(this, arguments).then(() => {
            this._initSelect2();
        });
    },

    /**
     * Initializes the Select2 library on the input dropdown.
     */
    _initSelect2: function () {
        const $input = this.$('input');
        $input.select2({
            containerCssClass: 'o_knowledge_select2',
            dropdownCssClass: 'o_knowledge_select2',
            ajax: {
                /**
                 * @param {String} term
                 * @returns {Object}
                 */
                data: term => {
                    return { term };
                },
                /**
                 * @param {Object} params - parameters
                 */
                transport: async params => {
                    const { term } = params.data;
                    const results = await this._rpc({
                        model: 'knowledge.article',
                        method: 'search_read',
                        kwargs: {
                            fields: ['id', 'display_name'],
                            domain: [['name', '=ilike', `%${term}%`]],
                        },
                    });
                    params.success({ results });
                },
                /**
                 * @param {Object} data
                 * @returns {Object}
                 */
                processResults: data => {
                    return {
                        results: data.results.map(record => {
                            return {
                                id: record.id,
                                display_name: record.display_name,
                            };
                        })
                    };
                },
            },
            /**
             * @param {Object} data
             * @param {JQuery} container
             * @param {Function} escapeMarkup
             */
            formatSelection: (data, container, escapeMarkup) => {
                return escapeMarkup(data.display_name);
            },
            /**
             * @param {Object} result
             * @param {JQuery} container
             * @param {Object} query
             * @param {Function} escapeMarkup
             */
            formatResult: (result, container, query, escapeMarkup) => {
                const { display_name } = result;
                const markup = [];
                window.Select2.util.markMatch(display_name, query.term, markup, escapeMarkup);
                return markup.join('');
            },
        });
    },

    /**
     * Callback function called when the user clicks on the confirm button of the dialog.
     */
    _onConfirmButtonClick: function () {
        const $input = this.$('input');
        this.trigger('confirm', $input.select2('data'));
    },
});

export {
    KnowledgeArticleLinkModal
};
