import pytz

from odoo import models, fields
from odoo.exceptions import UserError


class PosMakeInvoice(models.TransientModel):
    _name = 'pos.make.invoice'
    _description = 'Multiple order invoice creation'

    count = fields.Integer(string="Order Count", compute='_compute_count', store=True)
    pos_order_ids = fields.Many2many(
        'pos.order', default=lambda self: self.env.context.get('active_ids'))
    consolidated_billing = fields.Boolean(
        string="Consolidated Billing", default=True,
        help="Create one invoice for all orders related to same customer and same invoicing address"
    )

    def _compute_count(self):
        for wizard in self:
            wizard.count = len(wizard.pos_order_ids)

    # def _prepare_invoice_vals(self, partner):
        # timezone = pytz.timezone(self.env.user.tz or 'UTC')
        # invoice_date = fields.Datetime.now()
        # pos_refunded_invoice_ids = []
        # for orderline in self.pos_order_ids.lines:
        #     if orderline.refunded_orderline_id and orderline.refunded_orderline_id.order_id.account_move:
        #         pos_refunded_invoice_ids.append(orderline.refunded_orderline_id.order_id.account_move.id)
        # vals = {
        #     'invoice_origin': 'Combined',
        #     'pos_refunded_invoice_ids': pos_refunded_invoice_ids,
        #     'journal_id': self.session_id.config_id.invoice_journal_id.id,
        #     'move_type': 'out_invoice' if self.amount_total >= 0 else 'out_refund',
        #     'ref': self.name,
        #     'partner_id': partner.address_get(['invoice'])['invoice'],
        #     'partner_bank_id': self.partner_id.bank_ids[0].id if self.partner_id.bank_ids else False,
        #     'currency_id': self.currency_id.id,
        #     'invoice_user_id': self.user_id.id,
        #     'invoice_date': invoice_date.astimezone(timezone).date(),
        #     'fiscal_position_id': self.fiscal_position_id.id,
        #     'invoice_line_ids': self._prepare_invoice_lines(),
        #     'invoice_payment_term_id': partner.property_payment_term_id.id or False,
        #     'invoice_cash_rounding_id': self.config_id.rounding_method.id
        #     if self.config_id.cash_rounding and (not self.config_id.only_round_cash_method or any(p.payment_method_id.is_cash_count for p in self.payment_ids))
        #     else False
        # }
        # if self.refunded_order_id.account_move:
        #     vals['ref'] = _('Reversal of: %s', self.refunded_order_id.account_move.name)
        #     vals['reversed_entry_id'] = self.refunded_order_id.account_move.id
        # if self.floating_order_name:
        #     vals.update({'narration': self.floating_order_name})
        # return vals

    def create_invoices(self):
        self.ensure_one()
        breakpoint()
        if any(order_id for order_id in self.pos_order_ids if not order_id.partner_id):
            raise UserError("Some orders don't have a customer assigned.")
        invoices = self.env['account.move']
        if not self.consolidated_billing:
            for order in self.pos_order_ids:
                invoices |= order.action_pos_order_invoice(multi_invoice=True)
        # else:
        #     for partner in self.pos_order_ids.partner_id:
        #         partner_order = self.env['pos.order'].search([('id', 'in', self.pos_order_ids), ('parner_id', '=', partner.id)])
        #         move_vals = self._prepare_invoice_vals(partner)
        #         new_move = order._create_invoice(move_vals)

        #         order.write({'account_move': new_move.id, 'state': 'invoiced'})
        #         new_move.sudo().with_company(order.company_id).with_context(skip_invoice_sync=True)._post()

        #         moves += new_move
        #         payment_moves = order._apply_invoice_payments(order.session_id.state == 'closed')
        #     pass