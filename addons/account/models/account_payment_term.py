# -*- coding: utf-8 -*-

from odoo import api, fields, models, _, Command
from odoo.exceptions import UserError, ValidationError
from odoo.tools import format_date, formatLang

from dateutil.relativedelta import relativedelta


class AccountPaymentTerm(models.Model):
    _name = "account.payment.term"
    _description = "Payment Terms"
    _order = "sequence, id"

    def _default_line_ids(self):
        return [Command.create({'value': 'balance', 'value_amount': 0.0, 'days': 0, 'end_month': False})]

    name = fields.Char(string='Payment Terms', translate=True, required=True)
    active = fields.Boolean(default=True, help="If the active field is set to False, it will allow you to hide the payment terms without removing it.")
    note = fields.Html(string='Description on the Invoice', translate=True, default="")
    line_ids = fields.One2many('account.payment.term.line', 'payment_id', string='Terms', copy=True, default=_default_line_ids)
    company_id = fields.Many2one('res.company', string='Company')
    sequence = fields.Integer(required=True, default=10)
    display_on_invoice = fields.Boolean(string='Display terms on invoice', help="If set, the payment deadlines and respective due amounts will be detailed on invoices.")
    example_amount = fields.Float(default=100, store=False)
    example_date = fields.Date(string='Date example', default=fields.Date.context_today, store=False)
    example_invalid = fields.Boolean(compute='_compute_example_invalid')
    example_preview = fields.Html(compute='_compute_example_preview')

    @api.depends('line_ids')
    def _compute_example_invalid(self):
        for payment_term in self:
            payment_term.example_invalid = len(payment_term.line_ids.filtered(lambda l: l.value == 'balance')) != 1

    @api.depends('example_amount', 'example_date', 'line_ids.value', 'line_ids.value_amount',
                 'line_ids.months', 'line_ids.days', 'line_ids.end_month', 'line_ids.days_after')
    def _compute_example_preview(self):
        for record in self:
            example_preview = ""
            if not record.example_invalid:
                currency = self.env.company.currency_id
                terms = record.compute(record.example_amount, record.example_amount, record.example_date, currency)
                for i, (date, amount) in enumerate(record._get_amount_by_date(terms, currency).items()):
                    example_preview += f"""
                        <div style='margin-left: 20px;'>
                            <b>{i+1}#</b>
                            Installment of
                            <b>{formatLang(self.env, amount, monetary=True, currency_obj=currency)}</b>
                            on 
                            <b style='color: #704A66;'>{date}</b>
                    """
                    if terms[i].get('discount_amount'):
                        example_preview += f"""
                         (<b>{terms[i].get('discount_amount')}</b> if paid before <b>{format_date(self.env, terms[i].get('discount_date'))}</b>)
                    """
                    example_preview += "</div>"

            record.example_preview = example_preview

    @api.model
    def _get_amount_by_date(self, terms, currency):
        """
        Returns a dictionary with the amount for each date of the payment term (grouped by date, sorted by date and ignoring null amounts).
        """
        terms = sorted(terms, key=lambda t: t.get('date'))
        amount_by_date = {}
        for term in terms:
            date = term.get('date')
            amount = term.get('company_amount')
            date = format_date(self.env, date)
            if currency.compare_amounts(amount, 0) == 1:
                amount_by_date[date] = amount_by_date.get(date, 0) + amount
        return amount_by_date

    @api.constrains('line_ids')
    def _check_lines(self):
        for terms in self:
            if len(terms.line_ids.filtered(lambda r: r.value == 'balance')) != 1:
                raise ValidationError(_('The Payment Term must have one Balance line.'))

    def compute(self, company_value, foreign_value, date_ref, currency, untaxed_amount=0):
        """Get the distribution of this payment term.

        :param company_value (float): the amount to pay in the company's currency
        :param foreign_value (float): the amount to pay in the document's currency
        :param date_ref (datetime.date): the reference date
        :param currency (Model<res.currency>): the document's currency
        :return (list<tuple<datetime.date,tuple<float,float>>>): the amount in the company's currency and
            the document's currency, respectively for each required payment date
        """
        self.ensure_one()
        date_ref = date_ref or fields.Date.context_today(self)
        company_amount = company_value
        foreign_amount = foreign_value
        discount_date = None
        discount_amt = 0.0
        sign = company_value < 0 and -1 or 1
        result = []
        company_currency = self.env.company.currency_id
        for line in self.line_ids.sorted(lambda line: line.value == 'balance'):
            if line.value == 'fixed':
                company_amt = sign * company_currency.round(line.value_amount)
                foreign_amt = sign * currency.round(line.value_amount)
            elif line.value == 'percent':
                company_amt = company_currency.round(company_value * (line.value_amount / 100.0))
                foreign_amt = currency.round(foreign_value * (line.value_amount / 100.0))
            elif line.value == 'balance':
                company_amt = company_currency.round(company_amount)
                foreign_amt = currency.round(foreign_amount)
            if line.discount_percentage:
                discount_amt = company_currency.round(foreign_amt - (foreign_amt * (line.discount_percentage / 100.0)))
                company = self.company_id or self.env.company
                if company.early_pay_discount_computation == 'mixed':
                    tax_amount = foreign_amt - untaxed_amount
                    discount_amt = company_currency.round(untaxed_amount - (untaxed_amount * (line.discount_percentage / 100.0)))
                    discount_amt += tax_amount
                discount_date = date_ref + relativedelta(days=line.discount_days)
            result.append({
                'date': line._get_due_date(date_ref),
                'company_amount': company_amt,
                'foreign_amount': foreign_amt,
                'has_discount': line.discount_percentage,
                'discount_date': discount_date,
                'discount_amount': discount_amt,
                'discount_percentage': line.discount_percentage,
            })
            discount_date = None
            discount_amt = 0.0
            company_amount -= company_amt
            foreign_amount -= foreign_amt
        company_amount = sum(rec.get('company_amount') for rec in result)
        company_dist = company_currency.round(company_value - company_amount)
        foreign_amount = sum(rec.get('foreign_amount') for rec in result)
        foreign_dist = currency.round(foreign_value - foreign_amount)
        if company_dist or foreign_dist:
            last_date = result and result[-1].get('date') or fields.Date.context_today(self)
            result.append({
                'date': last_date,
                'company_amount': company_dist,
                'foreign_amount': foreign_dist
            })
        return result

    @api.ondelete(at_uninstall=False)
    def _unlink_except_referenced_terms(self):
        if self.env['account.move'].search([('invoice_payment_term_id', 'in', self.ids)]):
            raise UserError(_('You can not delete payment terms as other records still reference it. However, you can archive it.'))

    def unlink(self):
        for terms in self:
            self.env['ir.property'].sudo().search(
                [('value_reference', 'in', ['account.payment.term,%s'%payment_term.id for payment_term in terms])]
            ).unlink()
        return super(AccountPaymentTerm, self).unlink()


class AccountPaymentTermLine(models.Model):
    _name = "account.payment.term.line"
    _description = "Payment Terms Line"
    _order = "id"

    value = fields.Selection([
            ('balance', 'Balance'),
            ('percent', 'Percent'),
            ('fixed', 'Fixed Amount')
        ], string='Type', required=True, default='percent',
        help="Select here the kind of valuation related to this payment terms line.")
    value_amount = fields.Float(string='Value', digits='Payment Terms', help="For percent enter a ratio between 0-100.")
    months = fields.Integer(string='Months', required=True, default=0)
    days = fields.Integer(string='Days', required=True, default=0)
    end_month = fields.Boolean(string='End of month', help="Switch to end of the month after having added months or days")
    days_after = fields.Integer(string='Days after End of month', help="Days to add after the end of the month")
    discount_percentage = fields.Float(string='Discount %', help='Early Payment Discount granted for this line')
    discount_days = fields.Integer(string='Discount Days', help='Number of days before the early payment proposition expires')
    payment_id = fields.Many2one('account.payment.term', string='Payment Terms', required=True, index=True, ondelete='cascade')

    def _get_due_date(self, date_ref):
        due_date = fields.Date.from_string(date_ref)
        due_date += relativedelta(months=self.months)
        due_date += relativedelta(days=self.days)
        if self.end_month:
            due_date += relativedelta(day=31)
            due_date += relativedelta(days=self.days_after)
        return due_date

    @api.constrains('value', 'value_amount', 'discount_percentage')
    def _check_percent(self):
        for term_line in self:
            if term_line.value == 'percent' and (term_line.value_amount < 0.0 or term_line.value_amount > 100.0):
                raise ValidationError(_('Percentages on the Payment Terms lines must be between 0 and 100.'))
            if term_line.discount_percentage and (term_line.discount_percentage < 0.0 or term_line.discount_percentage > 100.0):
                raise ValidationError(_('Discount percentages on the Payment Terms lines must be between 0 and 100.'))

    @api.constrains('months', 'days', 'days_after', 'discount_days')
    def _check_positive(self):
        for term_line in self:
            if term_line.months < 0 or term_line.days < 0:
                raise ValidationError(_('The Months and Days of the Payment Terms lines must be positive.'))
            if term_line.discount_days < 0 or term_line.discount_days < 0:
                raise ValidationError(_('The discount days of the Payment Terms lines must be positive.'))
