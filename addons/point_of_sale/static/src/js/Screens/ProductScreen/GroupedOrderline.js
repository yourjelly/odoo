odoo.define('point_of_sale.GroupedOrderline', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const { float_is_zero } = require('web.utils');
    const { format, parse } = require('web.field_utils');

    class GroupedOrderline extends PosComponent {
        setup() {
            this.firstLine = this.props.groupedOrderlines[0];
        }

        onClickGroupedOrderline() {
            console.log("click");
        }

        getFullProductName() {
            return this.env.model.getFullProductName(this.firstLine);
        }

        getGroupedDisplayPrice() {
            let groupedPrice = 0;
            for (const line of this.props.groupedOrderlines) {
                groupedPrice += this.env.model.getOrderlineDisplayPrice(this.env.model.getOrderlinePrices(line));
             }
            return groupedPrice;
        }

        getGroupedQuantityStr() {
            const product = this.env.model.getRecord('product.product', this.props.groupedOrderlines[0].product_id);
            const unit = this.env.model.getRecord('uom.uom', product.uom_id);

            let qty = 0;
            for (const line of this.props.groupedOrderlines) {
                qty += line.qty;
             }

            if (unit) {
                if (unit.rounding) {
                    const decimals = this.env.model.getDecimalPrecision('Product Unit of Measure').digits;
                    return format.float(qty, { digits: [false, decimals] });
                } else {
                    return qty.toFixed(0);
                }
            } else {
                return '' + qty;
            }
        }

        getGroupedOrderlineUnit() {
            return this.env.model.getOrderlineUnit(this.props.groupedOrderlines[0]);
        }

        getDisplayUnitPrice() {
            let linePrice = this.env.model.getOrderlinePrices(this.props.groupedOrderlines[0]);
            return this.env.model.config.iface_tax_included === 'subtotal'
                ? linePrice.noTaxUnitPrice
                : linePrice.withTaxUnitPrice;
        }

        getProductLstPrice(orderline) {
            const order = this.env.model.getRecord('pos.order', orderline.order_id);
            const taxes = this.env.model.getFiscalPositionTaxes(
                this.env.model.getOrderlineTaxes(orderline),
                order.fiscal_position_id
            );
            const product = this.env.model.getRecord('product.product', orderline.product_id);
            const [withoutTax, withTax] = this.env.model.getUnitPrices(product.lst_price, taxes);
            return this.env.model.config.iface_tax_included === 'subtotal' ? withoutTax : withTax;
        }

        showListPrice() {
            let lstPrice = this.getProductLstPrice(this.props.groupedOrderlines[0])
            return (
                this.env.model.getDiscountPolicy(this.props.groupedOrderlines[0]) == 'without_discount' &&
                !float_is_zero(this.getDisplayUnitPrice() - lstPrice, this.env.model.currency.decimal_places)
            );
        }

        getFormattedDisplayUnitPrice() {
            return this.env.model.formatCurrency(this.getDisplayUnitPrice(), 'Product Price');
        }

        getOrderlineUnit() {
            let orderline = this.firstLine;
            const product = this.env.model.getRecord('product.product', orderline.product_id);
            const unit = this.env.model.getRecord('uom.uom', product.uom_id);
            return unit;
        }
    }
    GroupedOrderline.template = 'GroupedOrderline';

    return GroupedOrderline;
});
