# -*- coding: utf-8 -*-

from collections import defaultdict
from odoo import models, _


class PosConfig(models.Model):
    _inherit = "pos.session"

    def _initialize_amounts_to_accumulate(self, data):
        result = super()._initialize_amounts_to_accumulate(data)
        result["paid_invoice_receivables"] = defaultdict(data["amounts"])
        return result

    def _process_special_order(self, data, order):
        super()._process_special_order(data, order)
        paid_invoice = order.paid_invoice_id
        if paid_invoice:
            paid_invoice_receivables = data["paid_invoice_receivables"]
            order_account_move_receivable_lines = data["order_account_move_receivable_lines"]
            key = order.partner_id or paid_invoice.partner_id
            paid_invoice_receivables[key] = self._update_amounts(paid_invoice_receivables[key], {"amount": order.amount_total}, order.date_order)
            for move_line in paid_invoice.line_ids.filtered(lambda aml: aml.account_id.internal_type == "receivable" and not aml.reconciled):
                order_account_move_receivable_lines[move_line.account_id.id] |= move_line

    def _create_invoice_receivable_lines(self, data):
        result = super()._create_invoice_receivable_lines(data)
        paid_invoice_receivables = data.get("paid_invoice_receivables")
        paid_invoice_receivable_lines = self._create_invoice_receivable_lines_helper(data, paid_invoice_receivables, _("From paid invoices"))
        data.update({"paid_invoice_receivable_lines": paid_invoice_receivable_lines})
        return result

    def _get_receivable_lines_for_reconciliation(self, data, account_id):
        result = super()._get_receivable_lines_for_reconciliation(data, account_id)
        paid_invoice_receivable_lines = data.get('paid_invoice_receivable_lines')
        return result | paid_invoice_receivable_lines.get(account_id, self.env['account.move.line'])
