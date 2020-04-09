odoo.define('point_of_sale.ProductsList', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class ProductsList extends PosComponent {}
    ProductsList.template = 'ProductsList';

    Registries.Component.add(ProductsList);

    return ProductsList;
});
