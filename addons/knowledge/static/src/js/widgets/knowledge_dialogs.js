/** @odoo-module **/

import Dialog from 'web.Dialog';
import session from 'web.session';
import { _t } from 'web.core';

const MoveArticleToDialog = Dialog.extend({
    template: 'knowledge.knowledge_move_article_to_modal',
    /**
     * @override
     * @param {Widget} parent
     * @param {Object} options
     * @param {Object} data
     */
    init: function (parent, options, data) {
        // Set default options:
        options.title = options.title || _t('Move an Article');
        options.buttons = options.buttons || [{
            text: _t('Ok'),
            classes: 'btn-primary',
            click: this._onConfirmButtonClick
        }, {
            text: _t('Cancel'),
            close: true
        }];
        this._super(...arguments);
        this.data = data;
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
     * Returns the url of the logged in user's picture.
     * @returns {String}
     */
    getLoggedUserPicture: function () {
        return `/web/image?model=res.users&field=avatar_128&id=${session.uid}`;
    },

    /**
     * Initializes the Select2 library on the input dropdown.
     */
    _initSelect2: function () {
        const cache = {
            results: [{
                text: _t('Categories'),
                children: [{
                    id: 'private',
                    text: _t('Private'),
                    category: 'private',
                    selected: true
                }, {
                    id: 'workspace',
                    text: _t('Workspace'),
                    category: 'workspace'
                }]
            }]
        };

        const $input = this.$('input');
        $input.select2({
            containerCssClass: 'o_knowledge_select2',
            dropdownCssClass: 'o_knowledge_select2',
            data: cache, // Pre-fetched records
            ajax: {
                /**
                 * @param {String} term
                 * @returns {Object}
                 */
                data: term => {
                    return { term };
                },
                /**
                 * Function called to fetch the data from the server.
                 * @param {Object} params - request parameters
                 */
                transport: async params => {
                    const { term } = params.data; // search term of the user
                    this._rpc({
                        model: 'knowledge.article',
                        method: 'get_valid_parent_options',
                        args: [this.data.article.id],
                        kwargs: {
                            term
                        }
                    }).then(results => {
                        params.success({ term, results });
                    });
                },
                /**
                 * Function used to process the results fetched by the server.
                 * @param {Object} data - JSON object passed by the `transport` function (see the `success` callback)
                 * @param {String} data.term - search term of the user
                 * @param {Object} data.results - records fetched by the server
                 * @returns {Object}
                 */
                processResults: function (data) {
                    const records = { results: [] };
                    for (const result of cache.results) {
                        if (typeof result.children === 'undefined') {
                            records.results.push(result);
                            continue;
                        }
                        const children = result.children.filter(child => {
                            const text = child.text.toLowerCase();
                            const term = data.term.toLowerCase();
                            return text.indexOf(term) >= 0;
                        });
                        if (children.length > 0) {
                            records.results.push({...result, children});
                        }
                    }
                    if (data.results.length > 0) {
                        records.results.push({
                            text: _t('Articles'),
                            children: data.results.map(record => {
                                return {
                                    id: record.id,
                                    icon: record.icon,
                                    text: record.name,
                                    category: record.category
                                }
                            })
                        });
                    }
                    return records;
                },
            },
            /**
             * Function used to format the selection of the dropdown.
             * @param {Object} data
             * @param {JQuery} container
             * @param {Function} escapeMarkup
             */
            formatSelection: (data, container, escapeMarkup) => {
                const markup = [];
                if (data.id === 'private') {
                    const src = escapeMarkup(this.getLoggedUserPicture());
                    markup.push(`<img src="${src}" class="rounded-circle mr-1"/>`);
                } else if (typeof data.icon !== 'undefined') {
                    const icon = data.icon || '📄';
                    markup.push(`<span class="mr-1">${escapeMarkup(icon)}</span>`);
                }
                markup.push(escapeMarkup(data.text));
                return markup.join('');
            },
            /**
             * Function used to format the results of the dropdown items.
             * @param {Object} result
             * @param {JQuery} container
             * @param {Object} query
             * @param {Function} escapeMarkup
             */
            formatResult: (result, container, query, escapeMarkup) => {
                const { text } = result;
                const markup = [];
                window.Select2.util.markMatch(text, query.term, markup, escapeMarkup);
                if (result.id === 'private') {
                    const src = escapeMarkup(this.getLoggedUserPicture());
                    markup.unshift(`<img src="${src}" class="rounded-circle mr-1"/>`);
                } else if (typeof result.icon !== 'undefined') {
                    const icon = result.icon || '📄';
                    markup.unshift(`<span class="mr-1">${escapeMarkup(icon)}</span>`);
                }
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
    MoveArticleToDialog,
};
