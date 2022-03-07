/** @odoo-module **/

import fieldRegistry from 'web.field_registry';
import FieldHtml from 'web_editor.field.html';

const KnowledgeFieldHtml = FieldHtml.extend({
    DEBOUNCE: 5000,
    events: Object.assign({}, FieldHtml.prototype.events, {
        'click a': '_onLinkClick'
    }),
    /**
     * @override
     * @returns {Object}
     */
    _getWysiwygOptions: function () {
        const options = this._super.apply(this, arguments);
        options.onChange = () => {
            const editor = this.wysiwyg.odooEditor;
            editor.dispatchEvent(new Event('contentChanged'));
        };
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

fieldRegistry.add('knowledge_html', KnowledgeFieldHtml);

export default KnowledgeFieldHtml;
