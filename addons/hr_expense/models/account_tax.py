# -*- coding: utf-8 -*-

from odoo import api, models


class AccountTax(models.Model):
    _inherit = "account.tax"

    def _hook_compute_is_used(self, taxes_to_compute):
        # OVERRIDE in order to fetch taxes used in expenses

        used_taxes = super()._hook_compute_is_used(taxes_to_compute)
        taxes_to_compute -= used_taxes

        if taxes_to_compute:
            self.env['hr.expense'].flush_model(['tax_ids'])
            self.env.cr.execute("""
                SELECT id
                FROM account_tax
                WHERE EXISTS(
                    SELECT 1
                    FROM expense_tax AS exp
                    WHERE tax_id IN %s
                    AND account_tax.id = exp.tax_id
                )
            """, [tuple(taxes_to_compute)])

            used_taxes.update([tax[0] for tax in self.env.cr.fetchall()])

        return used_taxes

    @api.model
    def _prepare_base_line_for_taxes_computation(self, record, **kwargs):
        # EXTENDS 'account'.
        base_line = super()._prepare_base_line_for_taxes_computation(record, **kwargs)
        if record and isinstance(record, models.Model) and record._name == 'account.move.line':
            base_line['expense_id'] = record.expense_id
        return base_line

    @api.model
    def _prepare_tax_line_for_taxes_computation(self, record, **kwargs):
        # EXTENDS 'account'.
        tax_line = super()._prepare_tax_line_for_taxes_computation(record, **kwargs)
        if record and isinstance(record, models.Model) and record._name == 'account.move.line':
            tax_line['expense_id'] = record.expense_id.id
        return tax_line

    @api.model
    def _prepare_tax_line_grouping_key(self, base_line, tax_data):
        # EXTENDS 'account'.
        grouping_key = super()._prepare_tax_line_grouping_key(base_line, tax_data)
        if 'expense_id' in base_line:
            grouping_key['expense_id'] = base_line['expense_id'].id
        return grouping_key
