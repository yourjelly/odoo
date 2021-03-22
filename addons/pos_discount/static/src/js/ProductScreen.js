odoo.define('pos_discount.ProductScreen', function (require) {
    'use strict';

    const ProductScreen = require('point_of_sale.ProductScreen');
    const DiscountButton = require('pos_discount.DiscountButton');
    const { patch } = require('web.utils');

    const unpatch = {};

    unpatch.ProductScreen = patch(ProductScreen, 'pos_discount', {
        components: { ...ProductScreen.components, DiscountButton },
    });

    return unpatch;
});
