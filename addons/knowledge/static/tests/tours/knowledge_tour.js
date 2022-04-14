/** @odoo-module */

import tour from 'web_tour.tour';

tour.register('knowledge_editor_display', {
    test: true,
    url: '/web',
}, [
    tour.stepUtils.showAppsMenuItem(),
    {
        trigger: '.o_app[data-menu-xmlid="knowledge.knowledge_menu_root"]',
        content: 'Open the Knowledge app',
    },
    {
        trigger: '.btn-more',
        content: 'Click on the "more" button',
        run: 'click'
    },
    {
        trigger: '.o_knowledge_more_options_panel.show',
        run: function () {}
    },
]);
