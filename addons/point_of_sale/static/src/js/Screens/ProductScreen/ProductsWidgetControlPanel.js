odoo.define('point_of_sale.ProductsWidgetControlPanel', function(require) {
    'use strict';

    const { useRef } = owl.hooks;
    const PosComponent = require('point_of_sale.PosComponent');
    const ProductsWidget = require('point_of_sale.ProductsWidget');
    const Registry = require('point_of_sale.ComponentsRegistry');

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

    ProductsWidget.addComponents([ProductsWidgetControlPanel]);
    Registry.add('ProductsWidgetControlPanel', ProductsWidgetControlPanel);

    return ProductsWidgetControlPanel;
});
