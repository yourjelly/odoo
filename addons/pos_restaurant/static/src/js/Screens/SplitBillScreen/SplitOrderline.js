odoo.define('pos_restaurant.SplitOrderline', function(require) {
    'use strict';

    const { useListener } = require('web.custom_hooks');
    const PosComponent = require('point_of_sale.PosComponent');
    const SplitBillScreen = require('pos_restaurant.SplitBillScreen');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class SplitOrderline extends PosComponent {
        static template = 'SplitOrderline';
        constructor() {
            super(...arguments);
            useListener('click', this.onClick);
        }
        get isSelected() {
            return this.props.split.quantity !== 0;
        }
        onClick() {
            this.trigger('click-line', this.props.line);
        }
    }

    SplitBillScreen.addComponents([SplitOrderline]);
    Registry.add('SplitOrderline', SplitOrderline);

    return SplitOrderline;
});
