# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class ResCountryState(models.Model):
    _inherit = 'res.country.state'

    def get_l10n_in_state(self):
        # Retrieve data and return
        name = self.env['ir.sequence'].next_by_code('res.country.state')
        breakpoint()
        # data = self.search([])
        return data