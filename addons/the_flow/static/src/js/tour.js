odoo.define('flow.tour', function(require) {
"use strict";

var core = require('web.core');
var tour = require('web_tour.tour');

var _t = core._t;

tour.register('flow_tour', {
    url: "/web",
}, [tour.STEPS.MENU_MORE, {
    trigger: '.o_app[data-menu-xmlid="sales_team.menu_base_partner"], .oe_menu_toggler[data-menu-xmlid="sales_team.menu_base_partner"]',
    content: _t('Organize your sales activities with the <b>Sales app</b>.'),
    position: 'bottom',
}, {
    trigger: ".o_menu_sections a:contains('Catalog')",
    extra_trigger: '.o_main_navbar',
    content: _t("Let\'s create products."),
    position: "bottom"
}, {
    trigger: ".o_menu_sections a:has(span:contains('Products'))",
    extra_trigger: '.o_main_navbar',
    content: _t("Let\'s create products."),
    position: "bottom"
}, {
// Create product
    trigger: '.o-kanban-button-new',
    extra_trigger: '.o_kanban_view',
    content: _t('Let\'s create your first product.'),
    position: 'right',
}, {
    trigger: 'input[name="name"]',
    extra_trigger: '.o_form_sheet',
    content: _t('Let\'s enter the name.'),
    position: 'left',
    run: 'text ' + 'Stockable Product', // + randomString?
}, {
    trigger:  "select[name='type']",
    content: _t('Let\'s enter the product type'),
    position: 'left',
    run: 'text ' + '"product"',
}, {
    trigger: '.o_notebook a:contains("Inventory")',
    content: _t('Go to inventory tab'),
    position: 'top',
}, {
    trigger: '.o_field_widget[name="route_ids"] .o_checkbox + label:contains("Manufacture")',
    content: _t('Check Manufacture'),
    position: 'right',
}, {
    trigger: '.o_field_widget[name="route_ids"] .o_checkbox + label:contains("Buy")',
    content: _t('Uncheck Buy'),
    position: 'right',
}, {
    trigger: '.o_field_widget[name="route_ids"] .o_checkbox + label:contains("Make To Order")',
    content: _t('Uncheck  Make To Order'),
    position: 'right',
}, {
    trigger: '.o_form_button_save',
    content: _t('Save this product and the modifications you\'ve made to it.'),
    position: 'bottom',
}, {
    trigger: ".oe_button_box .oe_stat_button:has(div[name=\"bom_count\"])",
    extra_trigger: '.o_form_readonly',
    content: _t('See Bill of material'),
    position: 'bottom',
}, {
    trigger: ".o_list_button_add",
    content: _t("Let's create a new bill of material"),
    position: "right",
}, {
// Add First component
    trigger: ".o_field_x2many_list_row_add > a",
    extra_trigger: ".o_form_editable",
    content: _t("Click here to add some lines."),
    position: "bottom",
}, {
    trigger: ".o_selected_row .o_required_modifier[name=\"product_id\"] input",
    content: _t("Select a product, or create a new one on the fly."),
    position: "right",
    run: "text Composant1", // randomString?
}, {
    trigger: ".ui-menu-item > a",
    auto: true,
    in_modal: false,
    run: function (actions) {
        actions.auto();
        if ($(".modal-footer .btn-primary").length) {
            actions.auto(".modal-footer .btn-primary");
        }
    },
}, {
    // Add second component
    trigger: ".o_field_x2many_list_row_add > a",
    extra_trigger: '.o_field_widget[name="bom_line_ids"] .o_data_row:nth-child(1) > td:nth-child(2) input:propValue("Composant1")', //To fix
    content: _t("Click here to add some lines."),
    position: "bottom",
}, {
    trigger: ".o_selected_row .o_required_modifier[name=\"product_id\"] input",
    content: _t("Select a product, or create a new one on the fly."),
    position: "right",
    run: "text Composant2", // randomString?
}, {
    trigger: ".ui-menu-item > a",
    extra_trigger: ".o_form_editable",
    auto: true,
    in_modal: false,
    run: function (actions) {
        actions.auto();
        if ($(".modal-footer .btn-primary").length) {
            actions.auto(".modal-footer .btn-primary");
        }
    },
}, {
    trigger: '.o_form_button_save',
    extra_trigger: ".o_field_widget[name='bom_line_ids'] .o_list_view tr:nth-child(3):has(.o_field_x2many_list_row_add)",
    content: _t('Save the bom.'),
    position: 'bottom',
}, {
    trigger: ".breadcrumb li:not(.active):first",
    extra_trigger: '.o_form_view.o_form_readonly',
    content: _t("Use the breadcrumbs to <b>go back to products</b>."),
    position: "bottom"
}, {
// second product
    trigger: '.o-kanban-button-new',
    extra_trigger: '.o_kanban_view',
    content: _t('Let\'s create your second product.'),
    position: 'right',
}, {
    trigger: 'input[name="name"]',
    extra_trigger: '.o_form_sheet',
    content: _t('Let\'s enter the name.'),
    position: 'left',
    run: 'text ' + 'Service Product', // + randomString?
}, {
    trigger: '.o_field_widget[name="type"]',
    content: _t('Set to service'),
    position: 'left',
    run: 'text ' + '"service"', // + randomString?
}, {
    trigger: '.o_notebook a:contains("Invoicing")',
    content: _t('Go to invoicing tab'),
    position: 'bottom',
}, {
    trigger: '.o_field_widget[name="invoice_policy"] .o_radio_input[data-value="delivery"]',
    content: _t('Change invoicing policy'),
    position: 'left',
}, {
    trigger: '.o_field_widget[name="track_service"] input[data-value="task"]',
    content: _t('Change track service'),
    position: 'left',
}, {
    trigger: '.o_field_widget[name="project_id"] input',
    content: _t('Choose project'),
    position: 'left',
    run: 'text ' + 'Test', // + randomString?
}, {
    trigger: ".ui-menu-item > a",
    auto: true,
    in_modal: false,
    run: function (actions) {
        actions.auto();
        if ($(".modal-footer .btn-primary").length) {
            actions.auto(".modal-footer .btn-primary");
        }
    },
}, {
    trigger: '.o_form_button_save',
    content: _t('Save this product and the modifications you\'ve made to it.'),
    position: 'bottom',
}, {
    trigger: '.o_menu_toggle',
    extra_trigger: '.o_form_readonly',
    content: _t('Go back to the app switcher'),
    position: 'bottom',
}, {
    trigger: '.o_app[data-menu-xmlid="sales_team.menu_base_partner"], .oe_menu_toggler[data-menu-xmlid="sales_team.menu_base_partner"]',
    content: _t('Organize your sales activities with the <b>Sales app</b>.'),
    position: 'bottom',
}, {
    trigger: ".o_sales_dashboard .o_dashboard_action[name=\"crm.action_your_pipeline\"]:last",
    extra_trigger: '.o_sales_dashboard',
    content: _t("Let\'s have a look at your opportunities pipeline."),
    position: "bottom"
}, {
    trigger: ".o-kanban-button-new",
    extra_trigger: '.o_opportunity_kanban',
    content: _t("Click here to <b>create your first opportunity</b> and add it to your pipeline."),
    position: "right"
}, {
    trigger: ".modal-body input:first",
    auto: true,
    run: function (actions) {
        actions.auto();
        actions.auto(".modal-footer .btn-primary");
    },
}, {
    trigger: ".o_opportunity_kanban .o_kanban_group:first-child .o_kanban_record:last-child",
    content: _t("<b>Drag &amp; drop opportunities</b> between columns as you progress in your sales cycle."),
    position: "right",
    run: "drag_and_drop .o_opportunity_kanban .o_kanban_group:eq(2) ",
}, {
    trigger: ".o_kanban_record:has(span:contains('Test'))",
    extra_trigger: ".o_opportunity_kanban",
    content: _t("Click on an opportunity to zoom to it."),
    position: "bottom",
    run: function (actions) {
        actions.auto(".o_kanban_record .oe_kanban_action[data-type=edit]");
    },
}, {
    trigger: ".oe_button_box .oe_stat_button:has(span[name=\"sale_number\"])",
    content: _t('<p><b>Create a quotation</p>'),
    position: "right"
}, {
    trigger: ".o_list_button_add",
    content: _t("Let's create a new quotation.<br/><i>Note that colored buttons usually point to the next logical actions.</i>"),
    position: "right",
}, {
    trigger: ".o_required_modifier input",
    extra_trigger: ".o_sale_order",
    content: _t("Write the name of your customer to create one on the fly, or select an existing one."),
    position: "top",
    run: "text Agrolait",
}, {
    trigger: ".ui-menu-item > a",
    auto: true,
    in_modal: false,
    run: function (actions) {
        actions.auto();
        if ($(".modal-footer .btn-primary").length) {
            actions.auto(".modal-footer .btn-primary");
        }
    },
}, {
    trigger: ".o_field_x2many_list_row_add > a",
    extra_trigger: ".o_sale_order",
    content: _t("Click here to add some lines to your quotations."),
    position: "bottom",
}, {
    trigger: ".modal-body .o_required_modifier input, .o_list_view .o_required_modifier input",
    extra_trigger: ".o_sale_order",
    content: _t("Select a product, or create a new one on the fly. The product will define the default sales price (that you can change), taxes and description automatically."),
    position: "right",
    run: "text Stockable Product",
}, {
    trigger: ".ui-menu-item > a",
    auto: true,
    in_modal: false,
}, {
    trigger: ".o_field_x2many_list_row_add > a",
    extra_trigger: '.o_field_widget[name="order_line"] .o_data_row:nth-child(1) > td:nth-child(3) textarea:propValue("Stockable Product")', //To fix
    content: _t("Click here to add some lines to your quotations."),
    position: "bottom",
}, {
    trigger: ".modal-body .o_required_modifier input, .o_list_view .o_required_modifier input",
    extra_trigger: ".o_sale_order",
    content: _t("Select a product"),
    position: "right",
    run: "text Service Product",
}, {
    trigger: ".ui-menu-item > a",
    auto: true,
    in_modal: false,
}, {
    trigger: ".o_statusbar_buttons > button:contains('Send by Email'):not(.o_invisible_modifier)",
    extra_trigger: '.o_field_widget[name="order_line"] .o_data_row:nth-child(2) > td:nth-child(3) textarea:propValue("Service Product")', //To  fix
    content: _t("Try to send it to email"),
    position: "bottom",
}, {
    trigger: ".modal-footer .btn-primary",
    extra_trigger: ".modal-dialog",
    content: _t("Try to send it to email"),
    position: "bottom",
}, {
    trigger: ".o_sale_print",
    content: _t("<p><b>Print this quotation.</b></p>"),
    position: "bottom"
}, {
    trigger: ".o_form_button_save",
    content: _t("<p>Confirm this quotation</p>"),
    position: "bottom"
}, {
    trigger: '.o_menu_toggle',
    extra_trigger: '.o_form_readonly',
    content: _t('Go back to the app switcher'),
    position: 'bottom',
}, {
    //Go to purchase:
    trigger: '.o_app > div:contains("Purchases")',
    extra_trigger: '.o_apps',
    content: _t('Go to Purchase'),
    position: 'bottom',
}, {
    trigger: ".o_list_button_add",
    content: _t("Let's create a new purchase order"),
    position: "right",
}, {
    trigger: ".o_field_widget[name='partner_id'] input",
    extra_trigger: ".o_form_sheet",
    content: _t("Write the name of your vendor to create one on the fly, or select an existing one."),
    position: "top",
    run: "text ASUSTeK",
}, {
    trigger: ".ui-menu-item > a",
    auto: true,
    in_modal: false,
    run: function (actions) {
        actions.auto();
        if ($(".modal-footer .btn-primary").length) {
            actions.auto(".modal-footer .btn-primary");
        }
    },
}, {
    trigger: ".o_field_x2many_list_row_add > a",
    content: _t("Click here to add some lines to your request."),
    position: "bottom",
}, {
    trigger: ".o_selected_row .o_required_modifier[name=\"product_id\"] input",
    content: _t("Select a product, or create a new one on the fly."),
    position: "right",
    run: "text Stockable Product", // randomString?
}, {
    trigger: ".ui-menu-item > a",
    auto: true,
    in_modal: false,
}, {
    trigger: ".o_statusbar_buttons > button:contains('Confirm Order'):not(.o_invisible_modifier)",
    extra_trigger: '.o_field_widget[name="order_line"] .o_data_row:nth-child(1) > td:nth-child(3) textarea:propValue("Stockable Product")', //To  fix
    content: _t("Confirm quotation"),
    position: "bottom",
}, {
    trigger: ".o_statusbar_buttons > button:contains('Receive Products'):not(.o_invisible_modifier)",
    content: _t("Receive Product"),
    position: "bottom",
}, {
    trigger: ".o_statusbar_buttons > button:contains('Validate'):not(.o_invisible_modifier)",
    content: _t("Validate"),
    position: "bottom",
}, {
    trigger: ".modal-footer .btn-primary",
    extra_trigger: ".modal-dialog",
    content: _t("Apply"),
    position: "bottom",
}, {
    trigger: '.o_menu_toggle',
    extra_trigger: '.o_form_readonly',
    content: _t('Go back to the app switcher'),
    position: 'bottom',
}, {
    //Go to purchase:
    trigger: '.o_app > div:contains("Invoicing")',
    extra_trigger: '.o_apps',
    content: _t('Go to Invoicing'),
    position: 'bottom',
}, {
    trigger: ".o_menu_sections a:contains('Purchases')",
    extra_trigger: '.o_main_navbar',
    content: _t("Go to Purchases"),
    position: "bottom"
}, {
    trigger: ".o_menu_sections a:has(span:contains('Vendor Bills'))",
    extra_trigger: '.o_main_navbar',
    content: _t("Let\'s create a vendor bill."),
    position: "bottom"
}, {
    trigger: ".o_list_button_add",
    extra_trigger: '.breadcrumb > li:contains("Vendor Bills")',
    content: _t("Let's create a new vendor bill"),
    position: "right",
}, {
    trigger: ".o_field_widget[name='purchase_id'] input",
    extra_trigger: ".o_form_sheet",
    content: _t("Write the name of the last purchase order"),
    position: "bottom",
    run: 'text PO',
}, {
    trigger: ".ui-menu-item > a",
    auto: true,
    in_modal: false,
}, {
    trigger: ".o_statusbar_buttons > button:contains('Validate'):not(.o_invisible_modifier)",
    extra_trigger: ".o_field_widget[name='partner_id'] input:propValue('ASUSTeK')", //To  fix
    content: _t("Try to send it to email"),
    position: "bottom",
}, {
    trigger: ".o_statusbar_buttons > button:contains('Register Payment'):not(.o_invisible_modifier)",
    content: _t("Try to send it to email"),
    position: "bottom",
}, {
    trigger: "select.o_field_widget[name='journal_id']",
    extra_trigger: ".modal-dialog",
    content: _t("Select Journal"),
    position: "bottom",
    run: 'text 8', // to fix
}, {
    trigger: ".modal-footer .btn-primary",
    extra_trigger: ".o_field_radio[name='payment_method_id']",
    content: _t("Validate"),
    position: "bottom",
}, {
    trigger: '.o_menu_toggle',
    content: _t('Go back to the app switcher'),
    position: 'bottom',
}, {
    trigger: '.o_app > div:contains("Manufacturing")',
    extra_trigger: '.o_apps',
    content: _t('Go to Manufacturing'),
    position: 'bottom',
}, {
    trigger: ".o_list_button_add",
    content: _t("Let's create a new manufacturing order"),
    position: "right",
}, {
    trigger: '.o_field_widget input[name="product_id"]',
    extra_trigger: '.o_form_sheet',
    content: _t("Let\'s enter the product."),
    position: 'top',
    run: 'text ' + 'Stockable Product',

}]);
});
