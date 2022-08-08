from odoo import models, fields, api


class StockChannel(models.TransientModel):
    _name = 'pos.stock.channel'
    _description = 'pos.stock.channel'

    def broadcast(self, stock, message_type):
        bus = self.env["bus.bus"]

        bus.sendone(
            "pos_stock_channel",
            {"type": message_type, "message": stock}
        )
