odoo.define('point_of_sale.CashierName', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    // Previously UsernameWidget
    class CashierName extends PosComponent {
        static props = {
            cashier: { type: Object },
        }
        get username() {
            const { name } = this.props.cashier;
            return name ? name : '';
        }
        get avatar() {
            const { id } = this.props.cashier; // in point_of_sale, cashier = user
            return `/web/image/res.users/${id}/avatar_128`;
        }
    }
    CashierName.template = 'CashierName';

    Registries.Component.add(CashierName);

    return CashierName;
});
