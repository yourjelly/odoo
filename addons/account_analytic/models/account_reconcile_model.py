# -*- coding: utf-8 -*-

from odoo import api, fields, models


class AccountReconcileModelLine(models.Model):
    _inherit = 'account.reconcile.model.line'

    analytic_account_id = fields.Many2one('account.analytic.account', string='Analytic Account', ondelete='set null')
    analytic_tag_ids = fields.Many2many('account.analytic.tag', string='Analytic Tags',
                                        relation='account_reconcile_model_analytic_tag_rel')


class AccountReconcileModel(models.Model):
    _inherit = 'account.reconcile.model'

    def _get_taxes_move_lines_dict(self, tax, base_line_dict):
        new_aml_dicts = super(AccountReconcileModel, self)._get_taxes_move_lines_dict(tax, base_line_dict)
        for aml in new_aml_dicts:
            aml['analytic_account_id'] = tax.analytic and base_line_dict['analytic_account_id']
            aml['analytic_tag_ids'] = tax.analytic and base_line_dict['analytic_tag_ids']
        return new_aml_dicts

    def _get_writeoff_line(self, line, st_line, line_balance):
        writeoff_line = super(AccountReconcileModel, self)._get_writeoff_line( line, st_line, line_balance)
        writeoff_line['analytic_account_id'] = line.analytic_account_id.id
        writeoff_line['analytic_tag_ids'] = [(6, 0, line.analytic_tag_ids.ids)]
        return writeoff_line
