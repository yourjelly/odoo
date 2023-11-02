from odoo import api, fields, models

class StockStatementLedgerLine(models.Model):
    _name = 'stock.statement.ledger.line'
    _description = 'Stock Statement Ledger Line'
    
    product_name = fields.Char(string="Product Name")
    opening_stock = fields.Float(string="Opening Stock")
    
    @api.model
    def populate_opening_stock(self):
        Product = self.env['product.product']
        all_products = Product.search([])

        # Clear existing data
        self.unlink()


        for product in all_products:
            opening_qty = product.with_context(to_date=fields.Date.today()).qty_available
            existing_line = self.search([('product_name', '=', product.name)], limit=1)
            if existing_line:
                existing_line.write({'opening_stock': opening_qty})
            else:
                self.create({
                    'product_name': product.name,
                    'opening_stock': opening_qty
                })

    @api.model
    def search(self, args, offset=0, limit=None, order=None, count=False):
        result = super(StockStatementLedgerLine, self).search(args, offset=offset, limit=limit, order=order, count=count)
        if not args:
            self.populate_opening_stock()
        return result
