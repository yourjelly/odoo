from odoo import models, _
from odoo.exceptions import UserError


class Partner(models.Model):
    _inherit = 'res.partner'

    def write(self, vals):
        """
        1. We must now allow the change of tax number on an existing client file and with already issued documents.
           A missing tax number can only be entered if the field is empty or filled in with the generic client tax number “999999990”
        2. We must now allow the change of name in an existing client file with already issued documents but without indicated tax number.
           This limitation ends when the correspondent tax number is indicated in the clients file
        """
        if self.env.company.account_fiscal_country_id.code != 'PT':
            return super().write(vals)
        for partner in self:
            if 'vat' in vals and partner.vat and partner.vat != 'PT999999990' and self.env['account.move'].search_count([('partner_id', '=', partner.id)]):
                raise UserError(_("You cannot change the VAT number of a partner that already has issued invoices."))
            if 'name' in vals and not partner.vat and self.env['account.move'].search_count([('partner_id', '=', partner.id)]):
                raise UserError(_("You cannot change the name of a partner that already has issued invoices but no VAT number.\n "
                                  "To remove this restriction, you can add the VAT number of the partner."))
        return super().write(vals)
