from odoo import api, fields, models

class StockMoveLine(models.Model):
    _inherit = "stock.move.line"
    
    # New field to denote if a line is posted or not
    posted = fields.Boolean(string="Posted", default=False)
    
    @api.model
    def get_stock_in(self, location_id, product_id, date_range, posted=False):
        domain = [
            ('location_dest_id', '=', location_id),
            ('product_id', '=', product_id),
            ('date', '>=', date_range[0]),
            ('date', '<=', date_range[1]),
            ('state', '=', 'done')
        ]
        if posted:
            domain.append(('posted', '=', True))
        stock_in_lines = self.search(domain)
        return sum(stock_in_lines.mapped('qty_done'))

    @api.model
    def get_stock_out(self, location_id, product_id, date_range, posted=False):
        domain = [
            ('location_id', '=', location_id),
            ('product_id', '=', product_id),
            ('date', '>=', date_range[0]),
            ('date', '<=', date_range[1]),
            ('state', '=', 'done')
        ]
        if posted:
            domain.append(('posted', '=', True))
        stock_out_lines = self.search(domain)
        return sum(stock_out_lines.mapped('qty_done'))

    @api.model
    def get_stock_opening(self, location_id, product_id, date, posted=False):
        closing = self.get_stock_closing(location_id, product_id, date, posted)
        in_qty = self.get_stock_in(location_id, product_id, (date, date), posted)
        out_qty = self.get_stock_out(location_id, product_id, (date, date), posted)
        return closing + out_qty - in_qty

    @api.model
    def get_stock_closing(self, location_id, product_id, date, posted=False):
        opening = self.get_stock_opening(location_id, product_id, date, posted)
        in_qty = self.get_stock_in(location_id, product_id, (date, date), posted)
        out_qty = self.get_stock_out(location_id, product_id, (date, date), posted)
        return opening + in_qty - out_qty
