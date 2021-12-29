/** @odoo-module */

import { qweb as QWeb, _t } from 'web.core';
import Dialog from 'web.Dialog';
import FormController from 'web.FormController';

const KnowledgeFormController = FormController.extend({
    events: Object.assign({}, FormController.prototype.events, {
        'click .btn-delete': '_onDelete',
        'click .btn-duplicate': '_onDuplicate',
        'click .btn-create': '_onCreate',
        'click .btn-lock': '_onLock',
        'click .btn-move': '_onMove',
        'click .btn-share': '_onShare',
    }),

    // Listeners:

    _onDelete: async function () {
        const { id } = this.getState();
        if (typeof id === 'undefined') {
            return;
        }
        const result = await this._rpc({
            route: `/knowledge/article/${id}/delete` 
        });
        if (result) {
            const $li = this.$el.find(`[data-article-id="${id}"]`);
            $li.remove();
        }
    },

    _onDuplicate: async function () {
        const { id } = this.getState();
        if (typeof id === 'undefined') {
            return;
        }
        const result = await this._rpc({
            route: `/knowledge/article/${id}/duplicate`
        });
        console.log('result', result);
    },

    _onCreate: async function () {
        const { id } = this.getState();
        if (typeof id === 'undefined') {
            return;
        }
        const article = await this._rpc({
            route: `/knowledge/article/create`,
            params: {
                title: 'New file',
                target_parent_id: id
            }
        });
        if (!article) {
            return
        }
        const $li = QWeb.render('knowledge.knowledge_article_template', { article });
        const $parent = this.$el.find(`[data-article-id="${article.parent_id}"]`);
        if ($parent.length === 0) {
            console.log('no parent');
        } else {
            let $ul = $parent.find('ul');
            if ($ul.length === 0) {
                $ul = $('<ul>');
                $parent.append($ul);
            }
            $ul.append($li);
        }
    },

    _onMove: function () {
        const $content = $(QWeb.render('knowledge.knowledge_move_article_to_modal'));
        const dialog = new Dialog(this, {
            title: _t('Move Article To'),
            $content: $content,
            buttons: [{
                text: _t('Save'),
                classes: 'btn-primary',
                click: async () => {
                    console.log('moving the article...');
                    dialog.close();
                }
            }, {
                text: _t('Discard'),
                close: true
            }]
        });
        dialog.open();
    },

    _onNewLink: function () {
        const $content = $(QWeb.render('knowledge.knowledge_add_a_link_modal'));
        const dialog = new Dialog(this, {
            title: _t('Add a Link'),
            $content: $content,
            buttons: [{
                text: _('Save'),
                classes: 'btn-primary',
                click: async () => {
                    console.log('Creating a new link...');
                }
            }, {
                text: _('Discard'),
                click: async () => {
                    console.log('Discard...');
                    dialog.close();
                }
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
                text: _('Save'),
                classes: 'btn-primary',
                click: async () => {
                    console.log('sharing the article...');
                }
            }, {
                text: _('Discard'),
                click: async () => {
                    console.log('Discard...');
                    dialog.close();
                }
            }]
        });
        dialog.open();
    },

    /**
     * @param {Event} event 
     */
    _onLock: function (event) {
        const $target = $(event.target);
        const $icon = $target.find('i');
        if ($icon.hasClass('fa-lock')) {
            $icon.removeClass('fa-lock');
            $icon.addClass('fa-unlock');
            this._setMode('edit');
        } else {
            $icon.removeClass('fa-unlock');
            $icon.addClass('fa-lock');
            this._setMode('readonly');
        }
    },

    /**
     * @override
     */
    _setMode: function () {
        return this._super.apply(this, arguments).then(() => {
            this.renderer.initTree();
        });
    },
});

export {
    KnowledgeFormController,
};