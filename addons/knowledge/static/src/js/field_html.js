/** @odoo-module */

import FieldHtml from 'web_editor.field.html';
import {FieldHtmlInjector} from './knowledge_field_html_injector';
import {KnowledgePlugin} from './KnowledgePlugin';
import core from 'web.core';
const _t = core._t;

FieldHtml.include({
    /**
     * @override
     */
    _renderReadonly: function () {
        const prom = this._super.apply(this, arguments);
        if (prom) {
            return prom.then(function () {
                return this._addFieldHtmlInjector();
            }.bind(this));
        } else {
            return this._addFieldHtmlInjector();
        }
    },
    /**
     * Add a @see FieldHtmlInjector to this field_html, which will add temporary
     * @see KnowledgeBehavior and/or @see KnowledgeToolbar to @see OdooEditor
     * blocks. Delegate control of the editor history for those behaviors.
     * To avoid function duplicates for edit and readonly modes, create history
     * control dummies.
     *
     * @returns {Promise}
     */
    _addFieldHtmlInjector: function () {
        let historyMethods;
        if (this.mode == 'edit') {
            historyMethods = {
                observerActive: this.wysiwyg.odooEditor.observerActive.bind(this.wysiwyg.odooEditor),
                observerUnactive: this.wysiwyg.odooEditor.observerUnactive.bind(this.wysiwyg.odooEditor),
                historyStep: this.wysiwyg.odooEditor.historyStep.bind(this.wysiwyg.odooEditor),
            };
        } else {
            historyMethods = {
                observerActive: () => {},
                observerUnactive: () => {},
                historyStep: () => {},
            };
        }
        const fieldHtmlInjector = new FieldHtmlInjector(this, this.mode, this.$content[0], historyMethods);
        return fieldHtmlInjector.appendTo(this.el);
    },
    /**
     * @override
     */
    _onLoadWysiwyg: function () {
        this._super.apply(this, arguments);
        this._addFieldHtmlInjector();
        this.wysiwyg.odooEditor.addEventListener('historyUndo', () => this.$content.trigger('refresh_injector'));
        this.wysiwyg.odooEditor.addEventListener('historyRedo', () => this.$content.trigger('refresh_injector'));
        this.$content[0].addEventListener('paste', () => this.$content.trigger('refresh_injector'));
        if (this.nodeOptions.knowledge_commands) {
            this._updateTableOfContents();
            this.wysiwyg.odooEditor.addDomListener(this.wysiwyg.odooEditor.editable, 'keyup', () => this._updateTableOfContents());
        }
    },
    _updateTableOfContents: function () {
        var doc = $(this.wysiwyg.odooEditor.editable);
        const $toc = doc.find('.o_knowledge_toc_content');
        if ($toc.length) {
            $toc.empty();
            const stack = [];
            const $titles = doc.find('h1, h2, h3, h4, h5, h6');
            let prevLevel = 0;
            $titles.each((_index, title) => {
                const level = ~~title.tagName.substring(1);
                if (level > stack.length && level > prevLevel) {
                    const $ol = $('<ol/>');
                    if (stack.length > 0) {
                        const $li = $('<li/>');
                        $li.append($ol);
                        stack[stack.length - 1].append($li);
                    }
                    stack.push($ol);
                }
                while (level < stack.length) {
                    stack.pop();
                }
                prevLevel = level;
                const $title = $(title);
                const $a = $('<a contenteditable="false" class="o_no_link_popover o_toc_link" href="#" id="' + _index + '"/>');
                $a.text($title.text());
                const $li = $('<li/>');
                $li.append($a);
                stack[stack.length - 1].append($li);
            });
            if (stack.length > 0) {
                $toc.append(stack[0].get(0));
            }
            else {
                $toc.append($('<i/>').text(_t('No content')));
            }
        }
    },
    /**
     * @override
     */
    _getWysiwygOptions: function () {
        const options = this._super.apply(this, arguments);
        if (Array.isArray(options.editorPlugins)) {
            options.editorPlugins.push(KnowledgePlugin);
        } else {
            options.editorPlugins = [KnowledgePlugin];
        }
        return options;
    },
});
