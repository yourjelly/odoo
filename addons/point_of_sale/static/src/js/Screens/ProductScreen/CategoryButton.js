odoo.define('point_of_sale.CategoryButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductsWidgetControlPanel = require('point_of_sale.ProductsWidgetControlPanel');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class CategoryButton extends PosComponent {
        static template = 'CategoryButton';
        get imageUrl() {
            return `${window.location.origin}/web/image?model=pos.category&field=image_128&id=${this.props.category.id}`;
        }
    }

    ProductsWidgetControlPanel.addComponents([CategoryButton]);
    Registry.add(CategoryButton);

    return CategoryButton;
});
