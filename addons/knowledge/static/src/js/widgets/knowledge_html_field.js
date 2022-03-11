/** @odoo-module **/

import fieldRegistry from 'web.field_registry';
import FieldHtml from 'web_editor.field.html';

const KnowledgeFieldHtml = FieldHtml.extend({
    events: Object.assign({}, FieldHtml.prototype.events, {
        'click a': '_onLinkClick'
    }),

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

fieldRegistry.add('knowledge_html', KnowledgeFieldHtml);

export default KnowledgeFieldHtml;
