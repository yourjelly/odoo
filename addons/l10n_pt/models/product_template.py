from odoo import models, _
from odoo.exceptions import UserError


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    def write(self, vals):
        """
        We must now allow the change, in an existing product file with already issued documents, of the ProductDescription field.
        """
        if self.env.company.account_fiscal_country_id.code != 'PT':
            return super().write(vals)
        for product in self:
            if 'name' in vals:
                if self.env['account.move.line'].search_count([('product_id', 'in', product.product_variant_ids.ids)]):
                    raise UserError(_("You cannot change the name of a product that is already used in issued invoices."))
        return super().write(vals)
