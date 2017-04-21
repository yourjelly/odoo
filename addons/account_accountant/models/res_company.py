# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

class ResCompany(models.Model):
    _inherit = 'res.company'

    account_accountant_opening_move = fields.Many2one(string='Opening journal entry', comodel_name='account.move', help="The journal entry containing all the opening journal items of this company's accounting.")
    account_accountant_opening_journal = fields.Many2one(string='Opening journal', comodel_name='account.journal', help="Journal when the opening moves of this company's accounting will be posted.")
    account_accountant_opening_date = fields.Date(string='Accounting opening date', help="Date of the opening entries of this company's accounting.")

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

    @api.model
    def setting_init_fiscal_year_action(self):
        current_company = self.env['res.company']._company_default_get()

        new_wizard = self.env['account.accountant.financial.year.op.wizard'].create({'company_id': current_company.id})
        view_id = self.env.ref('account_accountant.init_financial_year_opening_form').id

        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'account.accountant.financial.year.op.wizard',
            'target': 'new',
            'res_id': new_wizard.id,
            'views': [[view_id, 'form']],
        }

    @api.model
    def setting_init_bank_account_action(self):
        current_company = self.env['res.company']._company_default_get()
        bank_journal = self.env['account.journal'].search([('company_id','=',current_company.id), ('type','=','bank')], limit=1)

        view_id = self.env.ref('account_accountant.init_bank_journal_form').id

        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'account.journal',
            'target': 'new',
            'res_id': bank_journal.id,
            'views': [[view_id, 'form']],
        }
