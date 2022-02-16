/** @odoo-module */

import { qweb as QWeb, _t } from 'web.core';
import { browser } from '@web/core/browser/browser';
import { escapeRegExp } from '@web/core/utils/strings';
import Dialog from 'web.Dialog';
import FormController from 'web.FormController';

var core = require('web.core');

const KnowledgeFormController = FormController.extend({
    events: Object.assign({}, FormController.prototype.events, {
        'click .btn-delete': '_onDelete',
        'click .btn-duplicate': '_onDuplicate',
        'click .btn-create': '_onCreate',
        'click .btn-lock': '_onLock',
        'click .btn-move': '_onOpenMoveToModal',
        'click .btn-share': '_onShare',
        'click .o_article_create': '_onCreate',
        'click .o_search_bar': '_onSearch',
        'change .o_breadcrumb_article_name': '_onRename',
    }),

    custom_events: Object.assign({}, FormController.prototype.custom_events, {
        move: '_onMove',
        emoji_picked: '_onIconChange',
    }),

    // Listeners:

    /**
     * @override
     * The user will not be allowed to edit the article if it is locked.
     */
    _onQuickEdit: function () {
        const { data } = this.model.get(this.handle);
        if (data.is_locked) {
            return;
        }
        this._super.apply(this, arguments);
    },

    _onRename: async function (e) {
        const { id } = this.getState();
        if (typeof id === 'undefined') {
            return;
        }
        await this._rename(id, e.currentTarget.value);
    },

    _onDelete: async function () {
        const { id } = this.getState();
        if (typeof id === 'undefined') {
            return;
        }
        await this._delete(id);
    },

    _onDuplicate: async function () {
        const { id } = this.getState();
        if (typeof id === 'undefined') {
            return;
        }
        await this._duplicate(id);
    },

    /**
     * @param {Event} event
     */
    _onCreate: async function (event) {
        const $target = $(event.currentTarget);
        if ($target.hasClass('o_article_create')) {  // '+' button in side panel
            const $li = $target.closest('li');
            const id = $li.data('article-id');
            await this._create(id);
        } else {  // main 'Create' button
            await this._create(false, true);
        }
    },

    /**
     * @param {Event} event
     */
    _onMove: async function (event) {
        await this._move(event.data);
    },

    /**
     * Opens the "Move To" modal
     */
    _onOpenMoveToModal: function () {
        const { data } = this.model.get(this.handle);
        const $content = $(QWeb.render('knowledge.knowledge_move_article_to_modal', {
            display_name: data.display_name
        }));
        const $input = $content.find('input');
        $input.select2({
            ajax: {
                url: '/knowledge/get_articles',
                dataType: 'json',
                /**
                 * @param {String} term
                 * @returns {Object}
                 */
                data: term => {
                    return { query: term, limit: 30 };
                },
                /**
                 * @param {Array[Object]} records
                 * @returns {Object}
                 */
                results: records => {
                    return {
                        results: records.map(record => {
                            return {
                                id: record.id,
                                icon: record.icon,
                                text: record.name,
                            };
                        })
                    };
                }
            },
            /**
             * When the user enters a search term, the function will
             * highlight the part of the string matching with the
             * search term. (e.g: when the user types 'hello', the
             * string 'hello world' will be formatted as '<u>hello</u> world').
             * That way, the user can figure out why a search result appears.
             * @param {Object} result
             * @param {integer} result.id
             * @param {String} result.icon
             * @param {String} result.text
             * @returns {String}
             */
            formatResult: (result, _target, { term }) => {
                if (result.id === 'private') {
                    const { origin } = browser.location
                    const { context } = this.initialState;
                    result.src = `${origin}/web/image?model=res.users&field=avatar_128&id=${context.uid}`;
                }
                const $template = $(QWeb.render('knowledge.knowledge_search_result', result));
                // Highlight the matching term:
                term = escapeRegExp(_.escape(term));
                const pattern = new RegExp(`(${term})`, 'gi');
                const text = _.escape(result.text);
                const $label = $template.find('.label');
                $label.html(text.replaceAll(pattern, '<u>$1</u>'));
                return $template;
            },
        });
        const dialog = new Dialog(this, {
            title: _t('Move Article'),
            $content: $content,
            buttons: [{
                text: _t('OK'),
                classes: 'btn-primary',
                click: async () => {
                    const state = this.getState();
                    const value = $input.val();
                    const article_id = state.id;
                    const target_parent_id = isNaN(value) ? value : parseInt(value);
                    await this._move({
                        article_id,
                        target_parent_id,
                        onSuccess: () => {
                            this.renderer.moveArticleUnder(article_id, target_parent_id);
                            dialog.close();
                        },
                        onReject: () => {
                            dialog.close();
                        }
                    });
                }
            }, {
                text: _t('Cancel'),
                close: true
            }]
        });
        dialog.open();
    },

    _onShare: function () {
        const $content = $(QWeb.render('knowledge.knowledge_share_an_article_modal'));
        const dialog = new Dialog(this, {
            title: _t('Share a Link'),
            $content: $content,
            buttons: [{
                text: _t('Save'),
                classes: 'btn-primary',
                click: async () => {
                    console.log('sharing the article...');
                }
            }, {
                text: _t('Discard'),
                click: async () => {
                    dialog.close();
                }
            }]
        });
        dialog.open();
    },

    /**
     * @param {Event} event
     */
    _onLock: async function (event) {
        const { id } = this.getState();
        if (typeof id === 'undefined') {
            return;
        }
        await this._lock(id);
    },
    /**
     * @param {Event} event
     */
    _onSearch: function (event) {
        // TODO: change to this.env.services.commandes.openMainPalette when form views are migrated to owl
        core.bus.trigger("openMainPalette", {
            searchValue: "?",
        });
    },
    // API calls:

    /**
     * @param {integer} id - Parent id
     */
    _create: async function (id, setPrivate) {
        const articleId = await this._rpc({
            route: `/knowledge/article/create`,
            params: {
                target_parent_id: id,
                private: setPrivate
            }
        });
        if (!articleId) {
            return;
        }
        this.do_action('knowledge.action_show_article', {
            additional_context: {
                res_id: articleId
            }
        });
    },

    /**
     * @param {integer} id - Target id
     * @param {string} targetName - Target Name
     */
    _rename: async function (id, targetName) {
        const result = await this._rpc({
            route: `/knowledge/article/${id}/rename`,
            params: {
                title: targetName
            }
        });
        if (result) {
            // Change in Workspace and Private
            const $li = this.$el.find(`.o_tree [data-article-id="${id}"]`);
            $li.children(":first").find('.o_article_name').text(result);
            // Change in favourite if any match
            const $liFavourite = this.$el.find(`.o_tree_favourite [data-article-id="${id}"]`);
            $liFavourite.children(":first").find('.o_article_name').text(result);
        }
    },

    /**
     * @param {integer} id - Target id
     */
    _delete: async function (id) {
        const result = await this._rpc({
            route: `/knowledge/article/${id}/delete`
        });
        if (result) {
            this.do_action('knowledge.action_show_article', {});
        }
    },

    /**
     * @param {integer} id - Target id
     */
    _duplicate: async function (id) {
        const articleId = await this._rpc({
            route: `/knowledge/article/${id}/duplicate`
        });
        if (!articleId) {
            return;
        }
        this.do_action('knowledge.action_show_article', {
            additional_context: {
                res_id: articleId
            }
        });
    },

    /**
     * @param {Object} data
     * @param {integer} data.article_id
     * @param {(integer|String)} data.target_parent_id
     * @param {integer} [data.before_article_id]
     * @param {Function} data.onSuccess
     * @param {Function} data.onReject
     */
    _move: async function (data) {
        const params = { article_id: data.article_id };
        if (data.target_parent_id === 'shared') {
            // TODO: What should happen when the user drags an article in 'shared' ?
            data.onReject();
            return;
        }
        if (['workspace', 'private'].includes(data.target_parent_id)) {
            params.private = data.target_parent_id === 'private';
        } else {
            params.target_parent_id = data.target_parent_id;
            if (data.before_article_id) {
                params.before_article_id = data.before_article_id;
            }
        }
        const result = await this._rpc({
            route: `/knowledge/article/${data.article_id}/move`,
            params
        });
        if (result) {
            data.onSuccess();
        } else {
            data.onReject();
        }
    },

    /**
     * @param {integer} id - Target id
     * @returns {Promise}
     */
    _lock: async function (id) {
        const { data } = this.model.get(this.handle);
        const result = await this._rpc({
            route: `/knowledge/article/${id}/lock`,
            params: {
                is_locked: !data.is_locked
            }
        });
        if (result) {
            if (!data.is_locked) {
                await this._setMode('readonly');
            }
            await this.reload();
        }
    },

    /**
     * @param {Event} event
     */
    _onIconChange: async function (event) {
        const { article_id, unicode } = event.data;
        const result = await this._rpc({
            model: 'knowledge.article',
            method: 'write',
            args: [[article_id], { icon: unicode }],
        });
        if (result) {
            this.$el.find(`[data-article-id="${article_id}"]`).each(function() {
                const $icon = $(this).find('.o_article_icon:first');
                $icon.text(unicode);
            });
        }
    },
});

export {
    KnowledgeFormController,
};
