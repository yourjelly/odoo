/** @odoo-module */

import FieldHtml from 'web_editor.field.html';
import {FieldHtmlInjector} from './knowledge_field_html_injector';
import {KnowledgePlugin} from './knowledge_plugin';

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
     * blocks. Delegate control of the editor to the injector, mainly to access
     * history methods. i.e.: @see KnowledgeToolbar insertion in the dom should
     * not be registered in the user history
     *
     * @returns {Promise}
     */
    _addFieldHtmlInjector: function () {
        if (this.$content && this.$content.length) {
            const editor = (this.mode === 'edit' && this.wysiwyg) ? this.wysiwyg.odooEditor : null;
            const fieldHtmlInjector = new FieldHtmlInjector(this, this.mode, this.$content[0], editor);
            return fieldHtmlInjector.appendTo(this.el);
        }
    },
    /**
     * historyUndo (ctrl+z), historyRedo (ctrl+y) and paste are events which can
     * cause the insertion of new elements which may need a
     * @see KnowledgeBehavior and/or @see KnowledgeToolbar , so the
     * @see FieldHtmlInjector needs to be notified.
     *
     * @override
     */
    _onLoadWysiwyg: function () {
        this._super.apply(this, arguments);
        this._addFieldHtmlInjector();
        this.wysiwyg.odooEditor.addEventListener('historyUndo', () => this.$content.trigger('refresh_injector'));
        this.wysiwyg.odooEditor.addEventListener('historyRedo', () => this.$content.trigger('refresh_injector'));
        this.$content[0].addEventListener('paste', () => this.$content.trigger('refresh_injector'));
    },
    /**
     * Add a plugin (@see KnowledgePlugin ) for the @see OdooEditor which
     * implements @see cleanForSave in order to remove @see KnowledgeToolbar
     * before saving a record.
     *
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
