# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class Partner(models.Model):
    _inherit = "res.partner"

    def get_wallet(self, force_create=False):
        website = self.env['website'].get_current_website()
        wallet_id = self.wallet_ids.filtered(lambda wallet: wallet.website_id == website)
        if len(wallet_id) == 0:
            if force_create:
                return self.env["wallet"].create({
                    'partner_id': self.id,
                    'website_id': website.id
                })
            return wallet_id
        return wallet_id[0]
