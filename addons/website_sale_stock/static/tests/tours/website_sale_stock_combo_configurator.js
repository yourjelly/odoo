/** @odoo-module **/

import { registry } from '@web/core/registry';
import configuratorTourUtils from '@sale/js/tours/combo_configurator_tour_utils';
import stockConfiguratorTourUtils from '@website_sale_stock/js/tours/combo_configurator_tour_utils';

registry
    .category('web_tour.tours')
    .add('website_sale_stock_product_configurator', {
        url: '/shop?search=Combo product',
        steps: () => [
            {
                content: "Select Combo product",
                trigger: '.oe_product_cart a:contains("Combo product")',
                run: 'click',
            },
            {
                content: "Click on add to cart",
                trigger: '#add_to_cart',
                run: 'click',
            },
            configuratorTourUtils.assertQuantity(1),
            // Assert that it's impossible to add less than 1 product.
            configuratorTourUtils.setQuantity(0),
            configuratorTourUtils.assertQuantity(1),
            {
                content: "check that decrease button is disabled",
                trigger: `.modal button[name=sale_quantity_button_minus]:disabled`,
            },
            // Assert that an error is shown if the requested quantity isn't available.
            configuratorTourUtils.setQuantity(3),
            stockConfiguratorTourUtils.assertQuantityNotAvailable("Test product"),
            // Assert that a warning is shown if all available quantity is selected.
            configuratorTourUtils.selectComboItem("Test product", 1),
            configuratorTourUtils.setQuantity(2),
            stockConfiguratorTourUtils.assertAllQuantitySelected("Test product"),
            // Assert that it's impossible to add more products than available.
            configuratorTourUtils.setQuantity(3),
            configuratorTourUtils.assertQuantity(2),
            {
                content: "check that increase button is disabled",
                trigger: `.modal button[name=sale_quantity_button_plus]:disabled`,
            },
        ],
   });
