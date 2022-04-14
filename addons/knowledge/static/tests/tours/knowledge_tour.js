/** @odoo-module */

import tour from 'web_tour.tour';

tour.register('knowledge_share', {
    test: true,
    url: '/web',
}, [
    tour.stepUtils.showAppsMenuItem(),
    {
        trigger: '.o_app[data-menu-xmlid="knowledge.knowledge_menu_root"]',
        content: 'Open the Knowledge app',
    },
    {
        trigger: '.btn-share',
        content: 'Click on the share button',
        run: 'click'
    },
    {
        trigger: '.btn-invite',
        content: 'Open the invite wizard',
        run: 'click'
    },
    {
        trigger: 'select[name="permission"]',
        content: 'Set the user permission',
        run: function () {
            const $select = $('select[name="permission"]');
            $select.val('"write"').change();
        }
    },
    {
        trigger: 'div[name="partner_ids"] input',
        content: 'Search a user',
        run: 'text mark.brown23@example.com'
    },
    {
        trigger: 'ul.ui-autocomplete a:contains("Marc Demo")',
        in_modal: false,
        run: 'click'
    },
    {
        trigger: 'button[name="action_invite_members"]',
        content: 'Invite the users',
        run: 'click'
    },
    {
        trigger: '.btn-share',
        content: 'The invited user should appear here',
        run: 'click'
    },
]);

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
