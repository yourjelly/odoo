odoo.define('pos_coupon.Orderline', function (require) {
    'use strict';

    const Orderline = require('point_of_sale.Orderline');
    const Registries = require('point_of_sale.Registries');

    var PosCouponOrderline = Orderline.extend({
        get addedClasses() {
            return Object.assign({ 'program-reward': this.props.line.is_program_reward }, super.addedClasses);
        },

        /**
         * @override
         */
        get_full_product_name: function () {
            return "Coucou"
        },
    });

    Registries.Component.extend(Orderline, PosCouponOrderline);

    return Orderline;
});
