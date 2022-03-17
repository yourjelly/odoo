/** @odoo-module */

import FieldHtml from 'web_editor.field.html';
import {FieldHtmlInjector} from './knowledge_field_html_injector';
import {KnowledgePlugin} from './KnowledgePlugin';
import core from 'web.core';
const _t = core._t;

FieldHtml.include({
    events: Object.assign({}, FieldHtml.prototype.events, {
        'click a': '_onLinkClick'
    }),
    /**
     * @private
     * @override
     * @returns {Promise|undefined}
     */
    _renderReadonly: function () {
        const prom = this._super.apply(this, arguments);
        // add listener on click for all elements with class o_toc_link
        // this.$el.on('click', '.o_toc_link', this._onClickTocLink.bind(this));
        if (this.nodeOptions.knowledge_commands) {
            if (prom) {
                return prom.then(function () {
                    return this._addFieldHtmlInjector();
                }.bind(this));
            } else {
                return this._addFieldHtmlInjector();
            }
        }
        return prom;
    },
    /**
     * Appends the FieldHtmlInjector widget to the field, and start managing toolbars
     *
     * @private
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
     * A Toolbar may need to be reconstructed in edit mode, i.e.: when the user delete then undelete a knowledge_commands block
     *
     * @private
     * @override
     */
    _onLoadWysiwyg: function () {
        this._super.apply(this, arguments);
        if (this.nodeOptions.knowledge_commands) {
            this._addFieldHtmlInjector();
            this._updateTableOfContents();
            this.wysiwyg.odooEditor.addDomListener(this.wysiwyg.odooEditor.editable, 'keyup', () => this._updateTableOfContents());
            this.wysiwyg.odooEditor.addEventListener('historyUndo', () => this.$content.trigger('refresh_knowledge_toolbars'));
            this.wysiwyg.odooEditor.addEventListener('historyRedo', () => this.$content.trigger('refresh_knowledge_toolbars'));
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
    _getWysiwygOptions: function () {
        const options = this._super.apply(this, arguments);
        if (Array.isArray(options.editorPlugins)) {
            options.editorPlugins.push(KnowledgePlugin);
        } else {
            options.editorPlugins = [KnowledgePlugin];
        }
        return options;
    },
    /**
     * When the user clicks on an article link, we can directly open the
     * article in the current view without having to reload the page.
     * @param {Event} event
     */
    _onLinkClick: function (event) {
        const href = $(event.currentTarget).attr('href');
        const matches = href.match(/^\/article\/(\d+)(?:\/|(?:#|\?).*)?$/);
        if (matches) {
            event.preventDefault();
            const id = parseInt(matches[1]);
            this.trigger_up('open', {
                article_id: id
            });
        }
    },
});
