odoo.define('pos_mercury.ProductScreen', function(require) {
    'use strict';

    const ProductScreen = require('point_of_sale.ProductScreen');
    const Registries = require('point_of_sale.Registries');

    const PosMercuryProductScreen = ProductScreen =>
        class extends ProductScreen {
            mounted() {
                super.mounted();
                this.env.pos.barcode_reader.set_action_callback(
                    'credit',
                    this.credit_error_action.bind(this)
                );
            }
            credit_error_action() {
                this.showPopup('ErrorPopup', {
                    body: this.env._t('Go to payment screen to use cards'),
                });
            }
        };

    Registries.Component.extend(ProductScreen, PosMercuryProductScreen);

    return ProductScreen;
});
