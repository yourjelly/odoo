# -*- coding: utf-8 -*-

from odoo import api, models, fields


class PosMove(models.Model):
    _inherit = "pos.move"

    invoice_id = fields.Many2one("account.move", string="Invoice")

    @api.model
    def action_pay_invoice(self, vals):
        move = self.create(vals)
        try:
            move._pay_invoice()
        except Exception as e:
            return {"result": False, "message": e.message}
        return {"result": True}

    def _pay_invoice(self):
        for move in self:
            if not move.invoice_id:
                continue
            for payment in move.payment_ids:
                payment_method = payment.payment_method_id
                journal = payment_method.cash_journal_id if payment_method.is_cash_count else payment_method.bank_journal_id
                paymentWizard = (
                    self.env["account.payment.register"]
                    .with_context({"active_model": "account.move", "active_ids": move.invoice_id.ids})
                    .create(
                        {
                            "journal_id": journal.id,
                            "amount": payment.amount,
                        }
                    )
                )
                paymentWizard._create_payments()
