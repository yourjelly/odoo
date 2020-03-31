odoo.define('point_of_sale.Orderline', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const OrderWidget = require('point_of_sale.OrderWidget');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class Orderline extends PosComponent {
        static template = 'Orderline';
        selectLine() {
            this.trigger('select-line', { orderline: this.props.line });
        }
        lotIconClicked() {
            this.trigger('edit-pack-lot-lines', { orderline: this.props.line });
        }
        get addedClasses() {
            return {
                selected: this.props.line.selected,
            };
        }
    }

    OrderWidget.addComponents([Orderline]);
    Registry.add('Orderline', Orderline);

    return Orderline;
});
