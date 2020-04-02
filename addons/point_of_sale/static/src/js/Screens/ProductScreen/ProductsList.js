odoo.define('point_of_sale.ProductsList', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductsWidget = require('point_of_sale.ProductsWidget');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class ProductsList extends PosComponent {
        static template = 'ProductsList';
    }

    ProductsWidget.addComponents([ProductsList]);
    Registry.add(ProductsList);

    return ProductsList;
});
