odoo.define("stock_part.models", function (require) {
    const models = require("point_of_sale.models");
    const {csrf_token} = require('web.core');
    const {Gui} = require('point_of_sale.Gui');
    const {_t} = require('web.core');
    const {posbus} = require('point_of_sale.utils');

    models.load_fields("product.product", ["type"]);
    models.load_fields("pos.config", ["type", "location_id"]);


    class LongPolling {
        constructor(channels, cb, timeout, interval) {
            this.start = this.start.bind(this);
            this.handleSuccess = this.handleSuccess.bind(this);
            this.nextCall = this.nextCall.bind(this);
            this.channels = channels;
            this.cb = cb ?? (() => console.warn("longpolling with empty cb"));
            this.timeout = timeout ?? 30000;
            this.interval = interval ?? 5000;
            this.lastseen = "";
        }

        start() {
            $.ajax({
                type: 'POST',
                url: '/longpolling/poll',
                dataType: 'json',
                beforeSend: function (xhr) {
                    xhr.setRequestHeader('Content-Type', 'application/json');
                },
                data: JSON.stringify({
                    options: {csrf_token: csrf_token},
                    params: {
                        channels: this.channels,
                        last: 0,
                        options: {}
                    }
                }),
                success: this.handleSuccess,
                timeout: this.timeout,
                complete: this.nextCall,
            });
        }

        handleSuccess(data) {
            const data_string = JSON.stringify(data);
            if (data_string === this.lastseen) return;
            this.cb(data);
            this.lastseen = data_string;
        }

        nextCall() {
            setTimeout(this.start, this.interval);
        }
    }

    const _posmodel_super = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        _bus: null,

        initialize: function () {
            _posmodel_super.initialize.apply(this, arguments);
            const self = this;
            this.longpolling = new LongPolling(["pos_stock_channel"], _.bind(this.prepare_longpolling_data, this));
            this.ready.then(function () {
                self.longpolling.start();
            })
        },
        load_server_data: function () {
            const self = this;

            return _posmodel_super.load_server_data.apply(this, arguments).then(function () {
                const product_ids = Object.keys(self.db.product_by_id);
                const records = self.rpc({
                    model: 'stock.quant',
                    method: 'get_quants_by_product_id',
                    args: ["", product_ids, this.posmodel.config.picking_type_id[0]],
                });
                return records.then(function (quant_data) {
                    if (!self.db.stock_by_product_id?.length) { //  first time
                        self.db.add_stock(quant_data);
                    } else {
                        quant_data.forEach(function (quant) {
                            self.db.stock_by_product_id[quant.product_id[0]] = quant;
                        })
                    }
                });
            });
        },
        prepare_server_data: function (product_ids) {
            const self = this;
            if (!product_ids) product_ids = Object.keys(self.db.product_by_id);
            const records = self.rpc({
                model: 'stock.quant',
                method: 'get_quants_by_product_id',
                args: ["", product_ids, self.env.pos.config.picking_type_id[0]],
            });
            return records.then(function (quant_data) {
                if (!Object.keys(self.db.stock_by_product_id).length) self.db.add_stock(quant_data);
                else quant_data.forEach(function (quant) {
                    self.db.stock_by_product_id[quant.product_id[0]] = quant;
                })
                const order = self.get_order();
                if (order.finalized) return;
                order.orderlines.models.forEach(function (orderline) {
                    orderline.set_quantity(orderline.quantity);
                })
                return Promise.resolve(order.orderlines);
            });
        },
        prepare_longpolling_data: function (data) {
            const results = data?.result
                ?.filter(d => d.message.message.location_id === posmodel.config.location_id &&
                    d.message.message.quantity)
                ?.map(d => d.message.message) ?? false;

            if (!results) return;

            const map = _.indexBy(results, "id")
            this.prepare_server_data(Object.keys(map))
        },
        _save_to_server: function () {
            return _posmodel_super._save_to_server.apply(this, arguments).then(this._handle_failed_orders.bind(this));
        },
        _handle_failed_orders: function (server_ids) {
            if (server_ids[0] ?? true) return server_ids;
            const names = server_ids[1].map(({id}) => id);
            this.get_order_list().forEach(order => {
                if (names.includes(this.get_order().uid)) this.delete_current_order();
            })
            for (let order of server_ids[1]) {
                let new_order = this.add_new_order();
                for (let line of order.data.lines) {
                    let l = line[2];
                    new_order.add_product(this.db.get_product_by_id(l.product_id), {
                        quantity: l.qty,
                        discount: l.discount
                    });
                }
            }

            return Gui.showPopup('ErrorPopup', {
                title: _t(`OUT OF STOCK`),
                body: _t(`Review yor orders. It is recommended to refresh the page after seeing this error`)
            }).then(() => server_ids[1]);
        }
    });
});