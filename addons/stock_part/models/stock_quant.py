from odoo import models, fields, api


class StockQuant(models.Model):
    _inherit = "stock.quant"

    product_type = fields.Selection(related="product_id.type", store=True)

    def get_quants_by_product_id(self, product_ids, type):
        type = self.env["stock.picking.type"].browse(type)
        return self.search_read(
            [("product_id.id", "in", product_ids), ("location_id", "=", type.default_location_src_id.id)],
            ["available_quantity", "product_id"])

    @api.model
    def create(self, vals_list):
        stock = super(StockQuant, self).create(vals_list)

        if stock:
            self.env["pos.stock.channel"].broadcast(
                {"vals": vals_list, "id": self.id, "location_id": self.location_id.id}, message_type="__create__")
        return stock

    def write(self, vals):
        stock = super(StockQuant, self).write(vals)
        if stock:
            self.env["pos.stock.channel"].broadcast(
                {**vals, "id": self.product_id.id, "location_id": self.location_id.id}, message_type="__update__")
        return stock
