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
        const result = await this._rpc({
            route: `/knowledge/article/${id}/delete` 
        });
        console.log('result', result);
    },

    _onDuplicate: async function () {
        const { id } = this.getState();
        const result = await this._rpc({
            route: `/knowledge/article/${id}/duplicate`
        });
        console.log('result', result);
    },

    _onCreate: async function () {
        const result = await this._rpc({
            route: `/knowledge/article/create`,
            params: {
                title: 'New file'
            }
        });
        console.log('result', result);
        console.log('creating a new article', this);
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
        } else {
            $icon.removeClass('fa-unlock');
            $icon.addClass('fa-lock');
        }
    },

    /**
     * @override
     */
    _setMode: function () {
        console.log('_setMode', arguments)
        return this._super.apply(this, arguments);
    },
});

export {
    KnowledgeFormController,
};