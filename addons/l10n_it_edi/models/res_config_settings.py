# coding: utf-8
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    l10n_it_edi_test_mode = fields.Boolean(related='company_id.l10n_it_edi_test_mode', readonly=False,
                                           string='Test mode')
