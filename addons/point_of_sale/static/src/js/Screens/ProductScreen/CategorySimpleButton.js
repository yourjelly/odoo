odoo.define('point_of_sale.CategorySimpleButton', function(require) {
    'use strict';

    const { PosComponent, addComponents } = require('point_of_sale.PosComponent');
    const { ProductsWidgetControlPanel } = require('point_of_sale.ProductsWidgetControlPanel');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class CategorySimpleButton extends PosComponent {
        static template = 'CategorySimpleButton';
    }

    addComponents(ProductsWidgetControlPanel, [CategorySimpleButton]);
    Registry.add('CategorySimpleButton', CategorySimpleButton);

    return { CategorySimpleButton };
});
