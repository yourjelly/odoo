odoo.define('point_of_sale.ProductsWidgetControlPanel', function(require) {
    'use strict';

    const { useRef } = owl.hooks;
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class ProductsWidgetControlPanel extends PosComponent {
        static template = 'ProductsWidgetControlPanel';
        constructor() {
            super(...arguments);
            this.searchTimeout = null;
            this.searchWordInput = useRef('search-word-input');
        }
        clearSearch() {
            this.searchWordInput.el.value = '';
            this.trigger('clear-search');
        }
        updateSearch(event) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.trigger('update-search', event.target.value);
            }, 70);
        }
    }

    Registries.Component.add(ProductsWidgetControlPanel);

    return ProductsWidgetControlPanel;
});
