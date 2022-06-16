# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.exceptions import UserError


class PosBoxOut(models.TransientModel):
    _name = 'cash.box.out'
    _description = 'Cash Box Out'
    _register = False

    name = fields.Char(string='Reason', required=True)
    amount = fields.Float(string='Amount', digits=0, required=True)

    def run(self):
        context = dict(self._context or {})
        active_model = context.get('active_model', False)
        active_ids = context.get('active_ids', [])

        records = self.env[active_model].browse(active_ids)

        if active_model == 'pos.session':
            records = [session.cash_register_id for session in self.env[active_model].browse(active_ids) if
                       session.cash_register_id]
            if not records:
                raise UserError(_("There is no cash register for this PoS Session"))
        return self._run(records)

    def _run(self, records):
        for box in self:
            for record in records:
                if not record.journal_id:
                    raise UserError(_("Please check that the field 'Journal' is set on the Bank Statement"))
                if not record.journal_id.company_id.transfer_account_id:
                    raise UserError(_("Please check that the field 'Transfer Account' is set on the company."))
                box._create_bank_statement_line(record)
        return {}

    def _create_bank_statement_line(self, record):
        for box in self:
            if record.state == 'confirm':
                raise UserError(_("You cannot put/take money in/out for a bank statement which is closed."))
            values = box._calculate_values_for_statement_line(record)
            self.env['account.bank.statement.line'].sudo().create(values)

    def _calculate_values_for_statement_line(self, record):
        if not record.journal_id.company_id.transfer_account_id:
            raise UserError(_("You have to define an 'Internal Transfer Account' in your cash register's journal."))

        amount = self.amount or 0.0
        values = {
            'date': record.date,
            'statement_id': record.id,
            'journal_id': record.journal_id.id,
            'amount': amount,
            'payment_ref': self.name,
        }
        active_model = self.env.context.get('active_model', False)
        active_ids = self.env.context.get('active_ids', [])
        if active_model == 'pos.session' and active_ids:
            values['ref'] = self.env[active_model].browse(active_ids)[0].name
        return values
