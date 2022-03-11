/** @odoo-module **/

import { qweb as QWeb } from 'web.core';
import { DocumentWidget } from 'wysiwyg.widgets.media';
import MediaDialog from 'wysiwyg.widgets.MediaDialog';
import Wysiwyg from 'web_editor.wysiwyg';
import { KnowledgeArticleLinkModal } from 'knowledge.wysiwyg.article_link';
import { preserveCursor, setCursorStart } from '@web_editor/../lib/odoo-editor/src/OdooEditor';

const CustomDocumentWidget = DocumentWidget.extend({
    /**
     * @param {Object} img
     * @returns {HTMLElement}
     */
    _renderMedia: function (img) {
        const file = this._super(...arguments);
        const extension = (img.name && img.name.split('.').pop()) || img.mimetype;
        this.$media = $(QWeb.render('knowledge.file_block', {
            img: {
                name: img.name,
                extension: extension,
            },
        }));
        this.media = this.$media[0];
        this.media.querySelector('.o_knowledge_file_image').innerHTML = file.outerHTML;
        return this.media;
    }
});

const CustomMediaDialog = MediaDialog.extend({
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
     */
    init: function (parent, options) {
        if (options.knowledge_commands) {
            /**
             * knowledge_commands is a view option from a field_html that indicates that knowledge-specific commands should be loaded.
             * powerboxFilters is an array of functions used to filters commands displayed in the powerbox
             */
            if (options.powerboxFilters) {
                options.powerboxFilters.push(this._filterKnowledgeCommandGroupInTemplate);
            } else {
                options.powerboxFilters = [this._filterKnowledgeCommandGroupInTemplate];
            }
        }
        this._super.apply(this, arguments);
    },
    /**
     * Prevent usage of commands from the group "Knowledge" inside the block inserted by the /template Knowledge command.
     * The content of a /template block is destined to be used in odoo-editors in modules other than Knowledge,
     * where knowledge-specific commands are not available.
     * i.e.: one cannot use /template nor /file commands in a /template block (o_knowledge_template) in the OdooEditor
     *
     * @private
     * @param {Array} commands commands available in this wysiwyg
     * @returns {Array} commands that can be used after the filter was applied
     */
    _filterKnowledgeCommandGroupInTemplate: function (commands) {
        let anchor = document.getSelection().anchorNode;
        if (anchor.nodeType != 1) { // nodeType 1 is ELEMENT_NODE
            anchor = anchor.parentElement;
        }
        if (anchor && anchor.closest('.o_knowledge_template')) {
            commands = commands.filter(command => command.groupName != 'Knowledge');
        }
        return commands;
    },
    /**
     * @returns {Array[Object]}
     */
    _getCommands: function () {
        const commands = this._super();
        if (this.options.knowledge_commands) {
            commands.push({
                groupName: 'Knowledge',
                title: 'File',
                description: 'Embed a file.',
                fontawesome: 'fa-file',
                callback: () => {
                    this.openMediaDialog({
                        noVideos: true,
                        noImages: true,
                        noIcons: true,
                        noDocuments: false
                    }, CustomMediaDialog);
                }
            }, {
                groupName: 'Knowledge',
                title: "Template",
                description: "Add a template section.",
                fontawesome: 'fa-pencil-square',
                callback: () => {
                    this._insertTemplate();
                },
            }, {
                groupName: 'Medias',
                title: 'Article',
                description: 'Link an article.',
                fontawesome: 'fa-file',
                callback: () => {
                    this._insertArticleLink();
                }
            });
        }
        return commands;
    },
    _notifyKnowledgeFieldHtmlInjector(owner) {
        const toolbarsData = [];
        owner.querySelectorAll('.o_knowledge_toolbar_anchor').forEach(function (owner, anchor) {
            const type = Array.from(anchor.classList).find(className => className.startsWith('o_knowledge_toolbar_type_'));
            if (type) {
                toolbarsData.push({
                    owner: owner,
                    anchor: anchor,
                    type: type,
                });
            }
        }.bind(this, owner));
        this.$editable.trigger('refresh_knowledge_toolbars', { toolbarsData: toolbarsData });
    },
    /**
     * @private
     */
    _insertTemplate() {
        const templateHtml = $(QWeb.render('knowledge.template_block', {}))[0].outerHTML;
        const [owner] = this.odooEditor.execCommand('insertHTML', templateHtml);
        setCursorStart(owner.querySelector('.o_knowledge_content > p'));
        this._notifyKnowledgeFieldHtmlInjector(owner);
    },
    /**
     * @private
     */
    _insertArticleLink: function () {
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
     * @private
     * @override
     */
    _onMediaDialogSave(params, element) {
        const result = this._super(...arguments);
        if (!result) {
            return;
        }
        const [owner] = result;
        if (owner.classList.contains('o_knowledge_file')) {
            setCursorStart(owner.nextElementSibling);
            this._notifyKnowledgeFieldHtmlInjector(owner);
        }
        return result;
    },
});
