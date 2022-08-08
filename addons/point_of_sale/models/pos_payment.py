from odoo import api, fields, models, Command, _
from odoo.tools import formatLang, float_is_zero
from odoo.exceptions import ValidationError


class PosPayment(models.Model):
    """ Used to register payments made in a pos.order.

    See `payment_ids` field of pos.order model.
    The main characteristics of pos.payment can be read from
    `payment_method_id`.
    """

    _name = "pos.payment"
    _description = "Point of Sale Payments"
    _order = "id desc"

    name = fields.Char(string='Label', readonly=True)
    pos_order_id = fields.Many2one('pos.order', string='Order', required=True)
    amount = fields.Monetary(string='Amount', required=True, currency_field='currency_id', readonly=True, help="Total amount of the payment.")
    payment_method_id = fields.Many2one('pos.payment.method', string='Payment Method', required=True)
    payment_date = fields.Datetime(string='Date', required=True, readonly=True, default=lambda self: fields.Datetime.now())
    currency_id = fields.Many2one('res.currency', string='Currency', related='pos_order_id.currency_id')
    currency_rate = fields.Float(string='Conversion Rate', related='pos_order_id.currency_rate', help='Conversion rate from company currency to order currency.')
    partner_id = fields.Many2one('res.partner', string='Customer', related='pos_order_id.partner_id')
    session_id = fields.Many2one('pos.session', string='Session', related='pos_order_id.session_id', store=True, index=True)
    company_id = fields.Many2one('res.company', string='Company', related='pos_order_id.company_id', store=True)
    card_type = fields.Char('Type of card used')
    cardholder_name = fields.Char('Cardholder Name')
    transaction_id = fields.Char('Payment Transaction ID')
    payment_status = fields.Char('Payment Status')
    ticket = fields.Char('Payment Receipt Info')
    is_change = fields.Boolean(string='Is this payment change?', default=False)
    account_move_id = fields.Many2one('account.move')

    @api.model
    def name_get(self):
        res = []
        for payment in self:
            if payment.name:
                res.append((payment.id, '%s %s' % (payment.name, formatLang(self.env, payment.amount, currency_obj=payment.currency_id))))
            else:
                res.append((payment.id, formatLang(self.env, payment.amount, currency_obj=payment.currency_id)))
        return res

    @api.constrains('payment_method_id')
    def _check_payment_method_id(self):
        for payment in self:
            if payment.payment_method_id not in payment.session_id.config_id.payment_method_ids:
                raise ValidationError(_('The payment method selected is not allowed in the config of the POS session.'))

    def _export_for_ui(self, payment):
        return {
            'payment_method_id': payment.payment_method_id.id,
            'amount': payment.amount,
            'payment_status': payment.payment_status,
            'card_type': payment.card_type,
            'cardholder_name': payment.cardholder_name,
            'transaction_id': payment.transaction_id,
            'ticket': payment.ticket,
            'is_change': payment.is_change,
        }

    def export_for_ui(self):
        return self.mapped(self._export_for_ui) if self else []

    def _prepare_aml_values_list_per_nature(self):
        self.ensure_one()

        order = self.pos_order_id
        commercial_partner = self.partner_id.commercial_partner_id
        company_currency = self.company_id.currency_id
        rate = self.currency_id._get_conversion_rate(self.currency_id, company_currency, self.company_id, self.payment_date)
        label = _("Payment of %s using %s", order.name, self.payment_method_id.name),
        outstanding_account = self.payment_method_id.outstanding_account_id \
                              or self.company_id.account_journal_payment_debit_account_id
        pos_receivable_account = self.company_id.account_default_pos_receivable_account_id
        amount_currency = self.amount
        balance = company_currency.round(amount_currency * rate)
        return {
            'outstanding': {
                'name': label,
                'account_id': outstanding_account.id,
                'partner_id': commercial_partner.id,
                'currency_id': self.currency_id.id,
                'amount_currency': amount_currency,
                'balance': balance,
            },
            'receivable': {
                'name': self.pos_order_id.name,
                'account_id': pos_receivable_account.id,
                'partner_id': commercial_partner.id,
                'currency_id': self.currency_id.id,
                'amount_currency': -amount_currency,
                'balance': -balance,
            },
            'counterpart_receivable': {
                'name': self.pos_order_id.name,
                'account_id': pos_receivable_account.id,
                'partner_id': commercial_partner.id,
                'currency_id': self.currency_id.id,
                'amount_currency': amount_currency,
                'balance': balance,
            },
        }

    def _prepare_account_payment_values(self):
        self.ensure_one()
        payment_amls_values_list_per_nature = self._prepare_aml_values_list_per_nature()

        # Replace the POS receivable account by the customer one since the payment will be reconciled with an invoice.
        payment_amls_values_list_per_nature['receivable']['account_id'] = self.partner_id.property_account_receivable_id.id

        is_inbound = self.currency_id.compare_amounts(self.amount, 0.0) >= 0
        return {
            'date': self.payment_date,
            'journal_id': self.payment_method_id.journal_id.id,
            'payment_type': 'inbound' if is_inbound else 'outbound',
            'partner_type': 'customer',
            'partner_id': self.partner_id.id,
            'amount': abs(self.amount),
            'line_ids': [
                Command.create(self.session_id._convert_to_closing_journal_item(payment_amls_values_list_per_nature['outstanding'])),
                Command.create(self.session_id._convert_to_closing_journal_item(payment_amls_values_list_per_nature['receivable'])),
            ],
        }

    def _create_payment_moves(self):
        moves = self.env['account.move'].create(
            payment._prepare_account_payment_values()
            for payment in self
            if payment.payment_method_id.type != 'pay_later' and not payment.pos_order_id.currency_id.is_zero(payment.amount)
        )
        moves.action_post()
        return moves
