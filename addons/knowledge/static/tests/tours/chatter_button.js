/** @odoo-module */

import tour from 'web_tour.tour';

tour.register('tour_chatter_button', {
    test: true,
    url: '/web',
}, [
    tour.stepUtils.showAppsMenuItem(),
    {
        trigger: '.o_app[data-menu-xmlid="knowledge.knowledge_menu_root"]',
        content: 'Open the Knowledge app',
    },
    {
        content: 'Click on the chat icon',
        trigger: '.btn-chatter',
    },
    {
        content: 'Click on the knowledge icon',
        trigger: '.o_ChatterTopbar_button .fa-book',
        run: 'click',
    },
    {
        content: 'Click on the second article',
        trigger: '.o_command:nth-child(2)',
        run: 'click',
    },
    {
        content: 'Check that you\'re redirected to the right page',
        trigger: '.o_tree',
        run: function () {
            const $article = $('.o_article:contains("Parent Article")');
            if ($article.has('.o_article_active').length === 0) {
                throw new Error(`Article "Parent Article" should be selected`);
            }
        },
    },
]);
