/** @odoo-module **/

import fieldRegistry from 'web.field_registry';
import FieldHtml from 'web_editor.field.html';

const KnowledgeFieldHtml = FieldHtml.extend({
    DEBOUNCE: 5000,
    /**
     * @override
     */
    _render: function () {
        this._super(...arguments);
        this._setFullWidthMode();
    },

    _setFullWidthMode: function () {
        const modifiers = this.record.evalModifiers(this.attrs.modifiers);
        if (modifiers.full_width) {
            this.$el.toggleClass('o_full_width', modifiers.full_width);
        }
    },
});

fieldRegistry.add('knowledge_html', KnowledgeFieldHtml);

export default KnowledgeFieldHtml;
