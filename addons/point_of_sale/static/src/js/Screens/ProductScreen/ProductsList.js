odoo.define('point_of_sale.ProductsList', function(require) {
    'use strict';

    const { PosComponent, addComponents } = require('point_of_sale.PosComponent');
    const { ProductsWidget } = require('point_of_sale.ProductsWidget');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class ProductsList extends PosComponent {
        static template = 'ProductsList';
    }

    addComponents(ProductsWidget, [ProductsList]);
    Registry.add('ProductsList', ProductsList);

    return { ProductsList };
});
