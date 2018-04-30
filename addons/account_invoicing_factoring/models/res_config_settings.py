# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    def configure_invocing_factoring(self):
        view = self.env.ref('account_invoicing_factoring.view_company_factoring_form')
        return {
            'name': _('Set your Finexkap Credentials'),
            'type': 'ir.actions.act_window',
            'view_type': 'form',
            'view_mode': 'form',
            'res_id': self.env.user.company_id.id,
            'res_model': 'res.company',
            'views': [(view.id, 'form')],
            'view_id': view.id,
            'target': 'new',
        }


class ResCompany(models.Model):
    _inherit = 'res.company'

    # TODO: Add fields for finexkap
    # Add fields for allowed currency (when open wizard fetch from service module)

# Add columns to add for configuration of client finexkap apikey
