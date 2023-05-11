# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    l10n_fr_reference_leave_type = fields.Many2one(
        'hr.leave.type',
        related='company_id.l10n_fr_reference_leave_type',
        readonly=False)
    l10n_fr_holiday_days_type = fields.Selection(
        related='company_id.l10n_fr_holiday_days_type',
        readonly=False)
