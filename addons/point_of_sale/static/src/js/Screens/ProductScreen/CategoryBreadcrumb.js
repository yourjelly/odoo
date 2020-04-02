odoo.define('point_of_sale.CategoryBreadcrumb', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductsWidgetControlPanel = require('point_of_sale.ProductsWidgetControlPanel');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class CategoryBreadcrumb extends PosComponent {
        static template = 'CategoryBreadcrumb';
    }

    ProductsWidgetControlPanel.addComponents([CategoryBreadcrumb]);
    Registry.add(CategoryBreadcrumb);

    return CategoryBreadcrumb;
});
