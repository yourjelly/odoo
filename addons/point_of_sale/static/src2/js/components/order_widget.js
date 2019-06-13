odoo.define("point_of_sale.OrderWidget", function(require) {
    "use strict";

    const Orderline = require("point_of_sale.Orderline");
    const { connect } = require("point_of_sale.BackboneStore");

    class OrderWidget extends owl.Component {
        constructor() {
            super(...arguments);
            this.components = { Orderline };
        }
    }

    OrderWidget.props = ["orderlines", "selectedOrder", "total", "taxes"];

    function mapModelToProps(model) {
        const selectedOrder = model.get_order();
        const orderlines = selectedOrder ? selectedOrder.get_orderlines() : [];
        const total = selectedOrder ? selectedOrder.get_total_with_tax() : 0;
        const taxes = selectedOrder ? total - selectedOrder.get_total_without_tax() : 0;
        return {
            orderlines,
            selectedOrder,
            total,
            taxes,
        };
    }

    return connect(
        OrderWidget,
        mapModelToProps
    );
});
