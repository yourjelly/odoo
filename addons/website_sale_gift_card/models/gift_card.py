# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class GiftCard(models.Model):
    _name = "gift.card"
    _inherit = ['website.multi.mixin', 'gift.card']

    def can_be_used(self):
        website = self.env['website'].get_current_website()
        return super(GiftCard, self).can_be_used() and self.website_id.id in [website.id, False]
