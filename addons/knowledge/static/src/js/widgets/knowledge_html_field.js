/** @odoo-module **/

import fieldRegistry from 'web.field_registry';
import FieldHtml from 'web_editor.field.html';

const KnowledgeFieldHtml = FieldHtml.extend({
    /**
     * @override
     */
    _renderReadonly: function () {
        this._super(...arguments);
        this.$content.on('click', 'a', this._onReadonlyClickLink.bind(this));
    },

    /**
     * When the user clicks on an article link, we can directly open the
     * article in the current view without having to reload the page.
     * @override
     * @param {Event} event
     */
    _onReadonlyClickLink: function (event) {
        const href = $(event.currentTarget).attr('href');
        const matches = href.match(/^\/article\/(\d+)(?:\/|(?:#|\?).*)?$/);
        if (matches) {
            event.preventDefault();
            const id = parseInt(matches[1]);
            this.trigger_up('open', { id });
        }
    },
});

fieldRegistry.add('knowledge_html', KnowledgeFieldHtml);

export default KnowledgeFieldHtml;
