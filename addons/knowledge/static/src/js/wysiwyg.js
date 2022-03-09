/** @odoo-module **/

import { qweb as QWeb } from 'web.core';
import { DocumentWidget } from 'wysiwyg.widgets.media';
import MediaDialog from 'wysiwyg.widgets.MediaDialog';
import Wysiwyg from 'web_editor.wysiwyg';
import { KnowledgeArticleLinkModal } from 'knowledge.wysiwyg.article_link';
import { preserveCursor } from '@web_editor/../lib/odoo-editor/src/OdooEditor';

const CustomDocumentWidget = DocumentWidget.extend({
    /**
     * @param {Object} img
     * @returns {HTMLElement}
     */
    _renderMedia: function (img) {
        let src = '';
        if (img.image_src) {
            src = img.image_src;
            if (!img.public && img.access_token) {
                src += _.str.sprintf('?access_token=%s', img.access_token);
            }
        }

        const dom = $(QWeb.render('knowledge.file_block', {
            img: img,
            src: src
        }));
        this.$media = dom;
        this.media = dom[0];

        // Add mimetype for documents
        if (!img.image_src) {
            this.media.dataset.mimetype = img.mimetype;
        }
        this.$media.trigger('image_changed');
        return this.media;
    }
});

MediaDialog.include({
    /**
     * @param {Object} media
     * @param {Object} options
     * @returns
     */
    getDocumentWidget: function (media, options) {
        return new CustomDocumentWidget(this, media, options);
    }
});

Wysiwyg.include({
    /**
     * @override
     * @param {Object} parent
     */
    init: function (parent) {
        this._super(...arguments);
        this.res_id = parent.res_id;
    },
    /**
     * @returns {Array[Object]}
     */
    _getCommands: function () {
        const commands = this._super();
        commands.push({
            groupName: 'Basic blocks',
            title: 'Alert block',
            description: 'Add alert block',
            fontawesome: 'fa-exclamation',
            callback: () => {
                this.addAlertBlock();
            },
        }, {
            groupName: 'Medias',
            title: 'File',
            description: 'Embed a file.',
            fontawesome: 'fa-file',
            callback: () => {
                this.openMediaDialog({
                    noVideos: true,
                    noImages: true,
                    noIcons: true,
                    noDocuments: false
                });
            }
        }, {
            groupName: 'Widgets',
            title: 'Article index',
            description: 'Add an article index',
            fontawesome: 'fa-bookmark',
            callback: () => {
                this.addArticleIndex();
            }
        });
        commands.push({
            groupName: 'Medias',
            title: 'Article',
            description: 'Link an article.',
            fontawesome: 'fa-file',
            callback: () => {
                this.addArticleLink();
            }
        });
        return commands;
    },
    addArticleLink: function () {
        const restoreSelection = preserveCursor(this.odooEditor.document);
        const dialog = new KnowledgeArticleLinkModal(this, {});
        dialog.on('save', this, data => {
            restoreSelection();
            const link = QWeb.render('knowledge.wysiwyg_article_link', {
                icon: data.icon,
                text: data.text,
                href: '/article/' + data.id
            });
            this.odooEditor.execCommand('insertHTML', link);
            dialog.close();
        });
        dialog.on('closed', this, () => {
            restoreSelection();
        });
        dialog.open();
    },
    /**
     * Adds the article index
     */
    addArticleIndex: async function () {
        const articles = JSON.parse(await this._rpc({
            model: 'knowledge.article',
            method: 'get_index',
            args: [this.res_id],
        }));
        const index = QWeb.render('knowledge.wysiwyg_index', { articles });
        this.odooEditor.execCommand('insertHTML', index);
    },
    /**
     * Adds an alert block
     */
    addAlertBlock: async function () {
        const alert = QWeb.render('knowledge.alert_block', {});
        this.odooEditor.execCommand('insertHTML', alert);
    },
});
