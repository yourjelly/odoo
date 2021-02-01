# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, models
from odoo.exceptions import UserError, ValidationError


class GiftCard(models.Model):
    _name = "gift.card"
    _inherit = ['website.multi.mixin', 'gift.card']

    # Logic
    def is_new(self, partner_id):
        website = self.env['website'].get_current_website()
        return super(GiftCard, self).is_new(partner_id) and self.website_id.id in [website.id, False]

    @api.constrains("website_id")
    def _website_change(self):
        for record in self:
            if record.state != "new":
                raise ValidationError(_("The gift card website cannot be changed after using."))

    def action_add_card(self):
        if not self.website_id or not self.partner_id:
            raise UserError(_("You need to specify website and partner."))
        return self.partner_id.with_context(website_id=self.website_id.id).add_gift_card(self)

    def _set_related_field(self, wallet_transaction_id):
        super(GiftCard, self)._set_related_field(wallet_transaction_id)
        self.website_id = wallet_transaction_id.wallet_id.website_id
