/** @odoo-module */

import FieldHtml from 'web_editor.field.html';
import {ToolbarsManager} from './knowledge_toolbars';
import {KnowledgePlugin} from './KnowledgePlugin';

FieldHtml.include({
    /**
     * @private
     * @override
     * @returns {Promise|undefined}
     */
    _renderReadonly: function () {
        const prom = this._super.apply(this, arguments);
        if (this.nodeOptions.knowledge_commands) {
            if (prom) {
                return prom.then(function () {
                    return this._addToolbarsManager();
                }.bind(this));
            } else {
                return this._addToolbarsManager();
            }
        }
        return prom;
    },
    /**
     * Appends the ToolbarsManager widget to the field, and start managing toolbars
     *
     * @private
     * @returns {Promise}
     */
    _addToolbarsManager: function () {
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
        const toolbarsManager = new ToolbarsManager(this, this.mode, historyMethods);
        return toolbarsManager.appendTo(this.el).then(toolbarsManager.manageToolbars.bind(toolbarsManager, this.$content[0]));
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
            this._addToolbarsManager();
            this.wysiwyg.odooEditor.addEventListener('historyUndo', () => this.$content.trigger('refresh_knowledge_toolbars'));
            this.wysiwyg.odooEditor.addEventListener('historyRedo', () => this.$content.trigger('refresh_knowledge_toolbars'));
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
});
