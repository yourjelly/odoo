odoo.define("stock_part.DB", function (require) {
    const DB = require('point_of_sale.DB');

    DB.include({
        init: function () {
            this._super.apply(this, arguments);
            this.stock_by_product_id = {};
            this.qty_by_product_id = {};
        },
        force_update_stock_by_product_id(id, qty) {
            if(this.stock_by_product_id[id]) this.stock_by_product_id[id].available_quantity += qty;
        },
        get_stock_by_product_id: function (product_id) {
            return this.stock_by_product_id[product_id] ?? false;
        },
        get_qty_by_product_id: function (product_id) {
            return this.qty_by_product_id[product_id] ?? false;
        },
        add_stock: function (stocks) {
            const stored_products = this.stock_by_product_id;
            const stored_quants = this.qty_by_product_id;
            if (!stocks instanceof Array) stocks = [product_ids];
            for (let stock of stocks) {
                const product_id = stock.product_id[0];
                if (!stored_quants[product_id]) stored_quants[product_id] = 0;
                stored_products[product_id] = stock;
            }
        }
    })

    return DB;
})