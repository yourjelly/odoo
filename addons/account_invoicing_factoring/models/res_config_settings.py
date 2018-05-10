# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, _


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    finexkap_account_status = fields.Char(related='company_id.finexkap_account_status', readonly=True)

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
