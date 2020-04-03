odoo.define('l10n_fr_pos_cert.ProductScreen', function(require) {

    const ProductScreen = require('point_of_sale.ProductScreen');
    const Registries = require('point_of_sale.Registries');

    const PosFrProductScreen = ProductScreen => class extends ProductScreen {
        disallowLineQuantityChange() {
            let order = this.env.pos.get_order();
            let selectedLine = order.get_selected_orderline();
            let last_id = Object.keys(order.orderlines._byId)[Object.keys(order.orderlines._byId).length-1];

            let result = super.disallowLineQuantityChange();

            return (this.env.pos.is_french_country() && this.numpadMode === 'quantity' && selectedLine.cid != last_id) || result;
        }
    };

    Registries.Component.extend(ProductScreen, PosFrProductScreen);

    return ProductScreen;
});
