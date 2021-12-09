/** @odoo-module */

import core from 'web.core'; 
import Dialog from 'web.Dialog';
import FormController from 'web.FormController';
import { MoveArticleToDialog } from 'knowledge.dialogs';

var QWeb = core.qweb;
var _t = core._t;

const KnowledgeFormController = FormController.extend({
    events: Object.assign({}, FormController.prototype.events, {
        'click .btn-duplicate': '_onDuplicate',
        'click .btn-create': '_onCreate',
        'click .btn-move': '_onOpenMoveToModal',
        'click .btn-share': '_onShare',
        'change .o_breadcrumb_article_name': '_onRename',
        'click i.o_toggle_favourite': '_onToggleFavourite',
    }),

    custom_events: Object.assign({}, FormController.prototype.custom_events, {
        create: '_onCreate',
        move: '_onMove',
    }),

    init: function (parent, model, renderer, params) {
        this.renderer = renderer;
        this._super.apply(this, arguments);
    },

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

    /**
     * @override
     */
    _onDeletedRecords: function () {
        this.do_action('knowledge.action_home_page', {});
    },

    _onDuplicate: async function () {
        var self = this;
        this.model.duplicateRecord(this.handle).then(function (handle) {
            const { res_id } = self.model.get(handle);
            self.do_action('knowledge.action_home_page', {
                additional_context: {
                    res_id: res_id
                }
            });
        });
    },

    /**
     * @param {Event} event
     */
    _onCreate: async function (event) {
        if (event instanceof $.Event) {
            await this._create({
                category: 'private'
            });
        } else {
            await this._create(event.data);
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
        const { id } = this.getState();
        if (typeof id === 'undefined') {
            return;
        }
        const state = this.model.get(this.handle);
        const dialog = new MoveArticleToDialog(this, {}, {
            state: state,
            /**
             * @param {String} value
             */
            onSave: async value => {
                const params = { article_id: id };
                if (typeof value === 'number') {
                    params.target_parent_id = value;
                } else {
                    params.category = value;
                }
                await this._move({...params,
                    onSuccess: () => {
                        dialog.close();
                        this.reload();
                    },
                    onReject: () => {}
                });
            }
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

    _onToggleFavourite: async function (event) {
        const self = this;
        const { id } = this.getState();
        if (typeof id === 'undefined') {
            return;
        }
        const result = await this._toggleFavourite(id);
        $(event.target).toggleClass('fa-star-o', !result).toggleClass('fa-star', result);
        event.target.title = result ? _t('Remove from favourites') : _t('Add to favourites');
        this._rpc({
            route: '/knowledge/get_favourite_tree'
        }).then(favouriteTemplate => {
            self.$(".o_favourite_container").replaceWith(favouriteTemplate);
            this.renderer._setTreeListener();
            this.renderer._renderEmojiPicker();
        });
    },

    // API calls:

    /**
     * @param {Object} data
     * @param {String} data.category
     * @param {integer} data.target_parent_id
     */
    _create: async function (data) {
        const articleId = await this._rpc({
            model: 'knowledge.article',
            method: 'article_create',
            args: [[]],
            kwargs: {
                private: data.category === 'private',
                parent_id: data.target_parent_id ? data.target_parent_id : false
            },
        });
        if (!articleId) {
            return;
        }
        this.do_action('knowledge.action_home_page', {
            stackPosition: 'replaceCurrentAction',
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
        // Change in Workspace and Private
        const $li = this.$el.find(`.o_tree [data-article-id="${id}"]`);
        $li.children(":first").find('.o_article_name').text(targetName);
        // Change in favourite if any match
        const $liFavourite = this.$el.find(`.o_tree_favourite [data-article-id="${id}"]`);
        $liFavourite.children(":first").find('.o_article_name').text(targetName);
    },

    /**
     * @param {Object} data
     * @param {integer} data.article_id
     * @param {String} data.category
     * @param {integer} [data.target_parent_id]
     * @param {integer} [data.before_article_id]
     * @param {Function} data.onSuccess
     * @param {Function} data.onReject
     */
    _move: async function (data) {
        const params = {
            private: data.category === 'private'
        };
        if (typeof data.target_parent_id !== 'undefined') {
            params.parent_id = data.target_parent_id;
        }
        if (typeof data.before_article_id !== 'undefined') {
            params.before_article_id = data.before_article_id;
        }
        const result = await this._rpc({
            model: 'knowledge.article',
            method: 'move_to',
            args: [data.article_id],
            kwargs: params
        });
        if (result) {
            data.onSuccess();
        } else {
            data.onReject();
        }
    },

    _toggleFavourite: async function (articleId) {
        this.saveChanges(this.handle);
        return await this._rpc({
            model: 'knowledge.article',
            method: 'action_toggle_favourite',
            args: [articleId]
        });
    },
});

export {
    KnowledgeFormController,
};
