odoo.define('pos_restaurant.SplitOrderline', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const { useListener } = require('web.custom_hooks');

    class SplitOrderline extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('click', this.onClick);
        }
        onClick() {
            this.trigger('click-line', this.props.line);
        }
    }
    SplitOrderline.template = 'SplitOrderline';

    return SplitOrderline;
});
