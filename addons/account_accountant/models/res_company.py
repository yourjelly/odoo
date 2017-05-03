# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models

from odoo.exceptions import UserError

#TODO OCO DEBUG
import logging
_logger=logging.getLogger(__name__)

class ResCompany(models.Model):
    _inherit = 'res.company'

    #TODO OCO revoir les noms des champs pour tout ce qui est des _id

    account_accountant_opening_move = fields.Many2one(string='Opening journal entry', comodel_name='account.move', help="The journal entry containing all the opening journal items of this company's accounting.")
    account_accountant_opening_journal = fields.Many2one(string='Opening journal', comodel_name='account.journal', related='account_accountant_opening_move.journal_id', help="Journal when the opening moves of this company's accounting has been posted.")
    account_accountant_opening_date = fields.Date(string='Accounting opening date', related='account_accountant_opening_move.date', help="Date of the opening entries of this company's accounting.")

    #TODO OCO les noms de ces deux champs devraient être un peu plus cohérents l'un avec l'autre
    account_accountant_opening_move_adjustment = fields.Monetary(string='Adjustment difference', help="Adjustment difference of this company's opening move.")
    account_accountant_opening_adjustment_account = fields.Many2one(string='Adjustment account', comodel_name='account.account', help="The account into which the opening move adjustment difference will be posted")

    #Setup fields
    account_accountant_setup_opening_move_done = fields.Boolean(string='Opening move posted', default=False, help="True iff an opening move has been posted.")
    #TODO OCO: Ajouter les champs qui correspondent aux autres étapes, pour permettre le 'mark as done' suggéré par Laura

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

        new_wizard = self.env['accountant.financial.year.op'].create({'company_id': current_company.id})
        view_id = self.env.ref('account_accountant.init_financial_year_opening_form').id

        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'accountant.financial.year.op',
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

    @api.model
    def setting_chart_of_accounts_action(self):
        view_id = self.env.ref('account.view_account_list').id

        return {
            'name': 'Accounts initialization',
           'type': 'ir.actions.act_window',
           'view_type': 'form',
           '#view_mode': 'tree',
           'res_model': 'account.account',
           'views': [[view_id, 'tree']],
           'target': 'current',
        }

    @api.model
    def setting_opening_move_action(self):
        current_company = self.env['res.company']._company_default_get()
        accounts = self.env['account.account'].search([('company_id','=',current_company.id)])

        new_wizard = self.env['accountant.opening'].create({'account_ids': [(4,acc.id,0) for acc in accounts], 'company_id': current_company.id})

        view_id = self.env.ref('account_accountant.init_opening_move_wizard_form').id

        return {
            'type': 'ir.actions.act_window',
            'view_mode': 'form',
            'res_model': 'accountant.opening',
            'target': 'new',
            'res_id': new_wizard.id,
            'views': [[view_id, 'form']],
        }

    @api.model #TODO OCO : documenter la nécessité de ces annotations
    def setting_chart_of_accounts_action(self):
        current_company = self._company_default_get()
        if not current_company.account_accountant_opening_move:

            default_journal = self.env['account.journal'].search([('type', '=', 'bank'), ('company_id', '=', current_company.id)], limit=1)

            if not default_journal:
                raise UserError("No journal of type 'bank' could be found. Please create one before proceeding.")

            current_company.account_accountant_opening_move = self.env['account.move'].create({
                'name': "Opening move",
                'company_id': current_company.id,
                'journal_id': default_journal.id,
            })

        # We return the name of the action to execute (to display the list of all the accounts,
        # now we have created an opening move allowing to post initial balances through this view.
        return 'account_accountant.action_accounts_setup_tree'
