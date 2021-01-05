# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class CrmUpdateProbabilities(models.TransientModel):
    _name = 'crm.lead.pls.update'
    _description = "Update the probabilities"

    def _get_default_pls_start_date(self):
        pls_start_date_config = self.env['ir.config_parameter'].sudo().get_param('crm.pls_start_date')
        return fields.Date.to_date(pls_start_date_config)

    pls_start_date = fields.Date(required=True, default=_get_default_pls_start_date)

    def action_update_crm_lead_probabilities(self):
        if self.env.user._is_admin():
            self.env['ir.config_parameter'].sudo().set_param('crm.pls_start_date', str(self.pls_start_date))
            self.env['crm.lead'].sudo()._cron_update_automated_probabilities()
