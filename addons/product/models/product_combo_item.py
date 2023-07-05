from odoo import fields, models, _


class ProductComboItem(models.Model):
    _name = "product.combo.item"
    _description = "Product Combo Items"

    product_id = fields.Many2one("product.product", string="Product")
    price = fields.Float("Price Extra", default=0.0)
    lst_price = fields.Float("Original Price", related="product_id.lst_price")
    combo_id = fields.Many2one("product.combo")
