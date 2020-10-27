from odoo import models, fields, api, _
from odoo.exceptions import UserError, RedirectWarning

class CashBox(models.TransientModel):
    _register = False

    name = fields.Char(string='Reason', required=True)
    # Attention, we don't set a domain, because there is a journal_type key
    # in the context of the action
    amount = fields.Float(string='Amount', digits=0, required=True)

    def run(self):
        context = dict(self._context or {})
        active_model = context.get('active_model', False)
        active_ids = context.get('active_ids', [])

        records = self.env[active_model].browse(active_ids)

        return self._run(records)

    def _run(self, records):
        for box in self:
            for record in records:
                if not record.journal_id:
                    raise UserError(_("Please set the field 'Journal' on the Bank Statement"))
                if not record.journal_id.company_id.transfer_account_id:
                    action_error = self.env.ref('account.action_account_config')
                    error_msg = _("Please set the field 'Transfer Account' in the company settings.")
                    raise RedirectWarning(error_msg, action_error.id, _('Go to the configuration panel'))
                box._create_bank_statement_line(record)
        return {}

    def _create_bank_statement_line(self, record):
        for box in self:
            if record.state == 'confirm':
                raise UserError(_("You cannot put/take money in/out for a bank statement which is closed."))
            values = box._calculate_values_for_statement_line(record)
            account = record.journal_id.company_id.transfer_account_id
            self.env['account.bank.statement.line'].with_context(counterpart_account_id=account.id).create(values)


class CashBoxOut(CashBox):
    _name = 'cash.box.out'
    _description = 'Cash Box Out'

    def _calculate_values_for_statement_line(self, record):
        if not record.journal_id.company_id.transfer_account_id:
            action_error = {
                'name': _('%s journal', record.journal_id.display_name),
                'type': 'ir.actions.act_window',
                'view_mode': 'form',
                'res_model': 'account.journal',
                'views': [[False, 'form']],
                'target': 'new',
                'res_id': record.journal_id.id,
            }
            error_msg = _("You have to define an 'Internal Transfer Account' on the %s journal.",
                          record.journal_id.display_name)
            raise RedirectWarning(error_msg, action_error, _('Show journal'))

        amount = self.amount or 0.0
        return {
            'date': record.date,
            'statement_id': record.id,
            'journal_id': record.journal_id.id,
            'amount': amount,
            'payment_ref': self.name,
        }
