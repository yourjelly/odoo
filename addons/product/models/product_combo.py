from odoo import api, fields, models, _


class ProductCombo(models.Model):
    _name = "product.combo"
    _description = "Product combo choices"

    name = fields.Char(string="Name", required=True)
    combo_product_ids = fields.One2many("product.combo.item", "combo_id", string="Products in Combo")
    no_of_products = fields.Integer("No of Products", compute="_compute_no_of_products")

    @api.depends("combo_product_ids")
    def _compute_no_of_products(self):
        for rec in self:
            rec.no_of_products = len(rec.combo_product_ids)
