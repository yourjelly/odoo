# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class ResCompany(models.Model):
    _inherit = 'res.company'

    @api.model
    def setting_init_company_action(self):
        current_company = self.env['res.company']._company_default_get()
        view_id = self.env.ref('account_accountant.init_view_company_form').id

        return {'type': 'ir.actions.act_window',
                'res_model': 'res.company',
                'target': 'new',
                'view_mode': 'form',
                'res_id': current_company.id,
                'views': [[view_id, 'form']],
        }

    def save_init_company_data(self):
        #return {'type': 'ir.actions.act_window_close'} < TODO OCO just closes, does not update status bar
        #TODO OCO we reload everything instead of just closing the wizard, because the status doesn't get updated otherwise ... any other way to do that ?
        return {'type': 'ir.actions.client', 'tag': 'reload'}