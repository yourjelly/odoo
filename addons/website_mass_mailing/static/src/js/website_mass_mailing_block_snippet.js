/** @odoo-module **/

import publicWidget from 'web.public.widget';

publicWidget.registry.NewsletterBlockSnippet = publicWidget.Widget.extend({
    selector: ".s_subscription_list",

    start() {
        let hasWebsiteFormEl = this.$el.has('.s_website_form').length;
        if (hasWebsiteFormEl) {
            let listId = parseInt(this.$el.data('list-id'));
            this.$('[data-for=newsletter_form]').attr('data-values', "{'list_id': " + listId + "}");
        }
    },

});
