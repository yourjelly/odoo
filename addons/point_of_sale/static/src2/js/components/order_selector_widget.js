odoo.define("point_of_sale.OrderSelectorWidget", function(require) {
    "use strict";

    const { connect } = require("point_of_sale.BackboneStore");

    class OrderSelectorWidget extends owl.Component {
        selectOrder(ev, elm) {
            const orders = this.env.model.get_order_list();
            const selected = orders.find(order => order.uid === elm.key);
            if (selected) {
                this.env.model.set_order(selected);
            }
        }
        newOrder() {
            this.env.model.add_new_order();
        }
        deleteOrder() {
            const selectedOrder = this.env.model.get_order();
            if (!selectedOrder) {
                return;
            }
            if (!selectedOrder.is_empty()) {
                // TODO: show confirm popup
                // title: _t('Destroy Current Order ?'),
                // body: _t('You will lose any data associated with the current order'),
                this.env.model.delete_current_order();
            } else {
                this.env.model.delete_current_order();
            }
        }
    }

    OrderSelectorWidget.props = ["orders", "selectedOrder"];
    OrderSelectorWidget.defaultProps = {
        orders: [],
    };

    function mapModelToProps(model) {
        return {
            orders: model.get_order_list(),
            selectedOrder: model.get_order(),
        };
    }

    return connect(
        OrderSelectorWidget,
        mapModelToProps
    );
});
