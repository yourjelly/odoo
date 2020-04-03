odoo.define('point_of_sale.CategoryButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class CategoryButton extends PosComponent {
        static template = 'CategoryButton';
        get imageUrl() {
            return `${window.location.origin}/web/image?model=pos.category&field=image_128&id=${this.props.category.id}`;
        }
    }

    Registries.Component.add(CategoryButton);

    return CategoryButton;
});
