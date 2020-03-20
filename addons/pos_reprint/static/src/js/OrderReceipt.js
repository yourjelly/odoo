odoo.define('pos_reprint.OrderReceipt', function(require) {
    'use strict';

    const OrderReceipt = require('point_of_sale.OrderReceipt');
    const Registry = require('point_of_sale.ComponentsRegistry');

    const PosReprintOrderReceipt = OrderReceipt =>
        class extends OrderReceipt {
            get receiptEnv () {
              if (this.props.isReprint) {
                return this.env.pos.last_receipt_render_env;
              }
              else {
                  const receipt_render_env = super.receiptEnv;
                  this.env.pos.last_receipt_render_env = receipt_render_env;
                  return receipt_render_env;
              }
            }
        };

    Registry.extend(OrderReceipt.name, PosReprintOrderReceipt);

    return OrderReceipt;
});
