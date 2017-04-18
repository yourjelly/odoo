odoo.define('website_sale.tour_shop_customize', function (require) {
'use strict';

var core = require("web.core");
var tour = require("web_tour.tour");
var base = require("web_editor.base");

var _t = core._t;

tour.register('customize_shop_product', {
    test: true,
    url: '/shop',
    wait_for: base.ready()
}, [
        {
            trigger: "a[data-action=edit]",
            content: _t("<b>Click Edit</b> to start customizing your shop."),
            position: "bottom",
        },
        {
            content: _t("Select Product"),
            position: "top",
            trigger: 'div.oe_product_cart[data-publish=on]:last',
            extra_trigger: "body.editor_has_snippets",
        },
        {
            trigger: "#oe_manipulators .oe_overlay.oe_active a.btn.btn-primary.btn-sm",
            content: _t("Customize Product"),
            position: "bottom",
        },
        {
            trigger: '.oe_options .dropdown-menu .snippet-option-website_sale:eq(2)',
            content: _t("Promot Product"),
            position: "bottom",
            run: function () {
                $('.oe_options .dropdown-menu .snippet-option-website_sale:eq(2) .dropdown-menu').css({
                    display: 'block',
                    left: '100%',
                    top: 0
                });
            }
        },
        {
            trigger: '.oe_options .dropdown-menu .snippet-option-website_sale:eq(2) .dropdown-menu li[data-go_to="top"] a',
            content: _t("Promot product to top"),
            position: "bottom",
        },
        {
            trigger: 'div.oe_product_cart[data-publish=on]:first',
            content: "Select Product",
            position: "top",
        },
        {
            trigger: "#oe_manipulators .oe_overlay.oe_active a.btn.btn-primary.btn-sm",
            content: "Add Sale Ribbon",
            position: "top",
            run: function() {
                $('.oe_options .dropdown-menu .snippet-option-website_sale:eq(1) .dropdown-menu li[data-toggle_class="oe_ribbon_promo"] a').trigger('click');
            }
        },
        {
            trigger: 'div.oe_product_cart[data-publish=on]:first',
            content: "Drag and drop product",
            position: "top",
            run: function(action_helper) {
                $("#products_grid tr:nth-child(2) .oe_grid:nth-child(3) div.oe_drop_zone").css({
                    height: '189px',
                    float: 'right',
                }).removeClass('hidden');
                action_helper.drag_and_drop("#products_grid tr:nth-child(2) .oe_grid:nth-child(3) div.cloned_drop_zone");
            }
        },
        {
            trigger: "button[data-action=save]",
            content: _t("Once you click on <b>Save</b>, your shop is updated."),
            position: "bottom",
        },
    ]
);
});