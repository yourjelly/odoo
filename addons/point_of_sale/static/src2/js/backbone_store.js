odoo.define("point_of_sale.BackboneStore", function() {
    "use strict";

    function connect(Comp, mapModelToProps, options = {}) {
        const getStore = env => ({ state: env.model });
        const connected = owl.connect(
            Comp,
            mapModelToProps,
            Object.assign({}, options, { getStore })
        );
        const { __callMounted, willUnmount } = Comp.prototype;
        return class extends connected {
            __callMounted() {
                const model = this.__owl__.store.state;
                model.on("change", this.__checkUpdate, this);
                const ordersCollection = model.get("orders");
                ordersCollection.models.forEach(order => {
                    this._registerOrderCheckUpdate(order);
                });
                ordersCollection.on("add", this._registerOrderCheckUpdate, this);
                ordersCollection.on("remove", this._unregisterOrderCheckUpdate, this);
                __callMounted.call(this);
            }
            willUnmount() {
                const model = this.__owl__.store.state;
                model.off("change", this.__checkUpdate, this);
                const ordersCollection = model.get("orders");
                ordersCollection.models.forEach(order => {
                    this._unregisterOrderCheckUpdate(order);
                });
                ordersCollection.off("add", this._registerOrderCheckUpdate, this);
                ordersCollection.off("remove", this._unregisterOrderCheckUpdate, this);
                willUnmount.call(this);
            }
            __checkUpdate() {
                // eslint-disable-next-line no-console
                console.debug("__checkUpdate", arguments);
                super.__checkUpdate.apply(this, arguments);
            }
            _registerOrderCheckUpdate(order) {
                // eslint-disable-next-line no-console
                console.debug("_registerOrderCheckUpdate", order);
                order.orderlines.on("change", this.__checkUpdate, this);
            }
            _unregisterOrderCheckUpdate(order) {
                // eslint-disable-next-line no-console
                console.debug("_unregisterOrderCheckUpdate", order);
                order.orderlines.off("change", this.__checkUpdate, this);
            }
        };
    }

    return {
        connect,
    };
});
