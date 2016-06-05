odoo.define('crm.tour', function(require) {
"use strict";

var tour = require('web_tour.tour');

tour.register('crm_tour', {
    'skip_enabled': true,
}, [{
    trigger: '.o_app[data-menu-xmlid="base.menu_base_partner"], .oe_menu_toggler[data-menu-xmlid="base.menu_base_partner"]',
    content: 'Organize your sales activities with the <b>CRM app</b>.',
    position: 'bottom',
}, {
    trigger: ".o-kanban-button-new",
    extra_trigger: '.o_opportunity_kanban',
    content: "Let\'s create a new business opportunity.",
    position: "right"
}, {
    trigger: ".o_kanban_record:nth-child(2)",
    extra_trigger: '.o_opportunity_kanban',
    content: "<b>Drag &amp; drop opportunities</b> between columns as you progress in your sales cycle.",
    position: "right"
}, {
    trigger: ".o_chatter_button_new_message",
    extra_trigger: '.o_opportunity_form',
    content: "<p><b>Send messages</b> to your prospect and get history of replies automatically attached to this opportunity.</p><p>Type <i>'@'</i> to mention people - it's like cc-ing on emails.</p>",
    position: "bottom"
}, {
    trigger: ".o_back_button",
    extra_trigger: '.o_opportunity_form',
    content: "Use the breadcrumd to quickly <b>go back to your sales pipeline</b>.",
    position: "bottom"
}]);

});
