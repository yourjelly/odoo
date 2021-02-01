# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class ProductTemplate(models.Model):
    _inherit = "product.template"
    is_gift_card = fields.Boolean(default=False,
                                  help="This product is converted to a gift card when purchased")

    @api.ondelete(at_uninstall=False)
    def _unlink_wallet_product(self):
        wallet_product_id = self.env['ir.model.data'].xmlid_to_object('wallet.pay_with_wallet_product')
        for record in self:
            if record == wallet_product_id.product_tmpl_id:
                raise UserError(_('Deleting of Wallet product is not allowed.'))
