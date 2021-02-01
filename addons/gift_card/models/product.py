# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class ProductTemplate(models.Model):
    _inherit = "product.template"
    is_gift_card = fields.Boolean(default=False,
                                  help="This product is converted into a gift card when purchased.")

    @api.ondelete(at_uninstall=False)
    def _unlink_gift_card_product(self):
        gift_card_product_id = self.env['ir.model.data'].xmlid_to_object('gift_card.pay_with_gift_card_product')
        for record in self:
            if record == gift_card_product_id.product_tmpl_id:
                raise UserError(_('Deleting of Gift Card Pay product is not allowed.'))
