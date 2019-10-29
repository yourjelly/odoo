# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError
from odoo.addons.account.models.account_payment import MAP_INVOICE_TYPE_PARTNER_TYPE

from collections import defaultdict


class AccountPaymentRegister(models.TransientModel):
    _name = 'account.payment.register'
    _description = 'Register Payment'

    # == Business fields ==
    payment_date = fields.Date(String="Payment Date", required=True,
        default=fields.Date.context_today)
    amount = fields.Monetary(currency_field='currency_id', store=True, readonly=False,
        compute='_compute_amount')
    communication = fields.Char(string="Memo", store=True, readonly=False,
        compute='_compute_communication')
    group_payment = fields.Boolean(string="Group Payments", store=True, readonly=False,
        compute='_compute_group_payment',
        help="Only one payment will be created by partner (bank)/ currency.")
    currency_id = fields.Many2one('res.currency', string='Currency', store=True, readonly=False,
        compute='_compute_currency_id',
        help="The payment's currency.")
    journal_id = fields.Many2one('account.journal', store=True, readonly=False,
        compute='_compute_journal_id',
        domain="[('company_id', '=', company_id), ('type', 'in', ('bank', 'cash'))]")
    partner_bank_id = fields.Many2one('res.partner.bank', string="Recipient Bank Account",
        readonly=False, store=True,
        compute='_compute_partner_bank_id',
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id), ('partner_id', '=', partner_id)]")
    company_currency_id = fields.Many2one('res.currency', string="Company Currency",
        related='company_id.currency_id')

    # == Fields given through the context ==
    line_ids = fields.Many2many('account.move.line', 'account_payment_register_move_line_rel', 'wizard_id', 'line_id',
        string="Journal items", readonly=True, copy=False,)
    payment_type = fields.Selection([
        ('outbound', 'Send Money'),
        ('inbound', 'Receive Money'),
    ], string='Payment Type', store=True, copy=False,
        compute='_compute_from_lines')
    partner_type = fields.Selection([
        ('customer', 'Customer'),
        ('supplier', 'Vendor'),
    ], store=True, copy=False,
        compute='_compute_from_lines')
    source_amount = fields.Monetary(
        string="Amount to Pay (company currency)", store=True, copy=False,
        currency_field='company_currency_id',
        compute='_compute_from_lines')
    source_amount_currency = fields.Monetary(
        string="Amount to Pay (foreign currency)", store=True, copy=False,
        currency_field='source_currency_id',
        compute='_compute_from_lines')
    source_currency_id = fields.Many2one('res.currency',
        string='Source Currency', store=True, copy=False,
        compute='_compute_from_lines',
        help="The payment's currency.")
    wizard_mode = fields.Selection(selection=[
        ('single_line', 'Single Journal Item'),
        ('single_batch', 'Single Batch'),
        ('one_per_batch', 'One by Batch'),
        ('multi_batches', 'Multiple Batches'),
    ], store=True, copy=False,
        compute='_compute_from_lines',
        help="Indicate if the user is free to edit the amount, the currency or create a write-off:"
             "* single Journal Entry:   Only one journal entry to pay"
             "* single batch:           Multiple journal entries belonging to the same batch"
             "* one by batch:           Multiple batches, one journal entry per batch"
             "* multiple batches:       Multiple batches")
    company_id = fields.Many2one('res.company', store=True, copy=False,
        compute='_compute_from_lines')
    partner_id = fields.Many2one('res.partner',
        string="Customer/Vendor", store=True, copy=False, ondelete='restrict',
        compute='_compute_from_lines')

    # == Payment methods fields ==
    payment_method_id = fields.Many2one('account.payment.method', string='Payment Method',
        readonly=False, store=True,
        compute='_compute_payment_method_id',
        domain="[('id', 'in', available_payment_method_ids)]",
        help="Manual: Get paid by cash, check or any other method outside of Odoo.\n"\
        "Electronic: Get paid automatically through a payment acquirer by requesting a transaction on a card saved by the customer when buying or subscribing online (payment token).\n"\
        "Check: Pay bill by check and print it from Odoo.\n"\
        "Batch Deposit: Encase several customer checks at once by generating a batch deposit to submit to your bank. When encoding the bank statement in Odoo, you are suggested to reconcile the transaction with the batch deposit.To enable batch deposit, module account_batch_payment must be installed.\n"\
        "SEPA Credit Transfer: Pay bill from a SEPA Credit Transfer file you submit to your bank. To enable sepa credit transfer, module account_sepa must be installed ")
    available_payment_method_ids = fields.Many2many('account.payment.method',
        compute='_compute_payment_method_fields')
    hide_payment_method = fields.Boolean(
        compute='_compute_payment_method_fields',
        help="Technical field used to hide the payment method if the selected journal has only one available which is 'manual'")

    # == Payment difference fields ==
    payment_difference = fields.Monetary(
        compute='_compute_payment_difference')
    payment_difference_handling = fields.Selection([
        ('open', 'Keep open'),
        ('reconcile', 'Mark invoice as fully paid'),
    ], default='open', string="Payment Difference Handling")
    writeoff_account_id = fields.Many2one('account.account', string="Difference Account", copy=False,
        domain="[('deprecated', '=', False), ('company_id', '=', company_id)]")
    writeoff_label = fields.Char(string='Journal Item Label', default='Write-Off',
        help='Change label of the counterpart that will hold the payment difference')

    # == Display purpose fields ==
    show_partner_bank_account = fields.Boolean(
        compute='_compute_show_require_partner_bank',
        help="Technical field used to know whether the field `partner_bank_id` needs to be displayed or not in the payments form views")
    require_partner_bank_account = fields.Boolean(
        compute='_compute_show_require_partner_bank',
        help="Technical field used to know whether the field `partner_bank_id` needs to be required or not in the payments form views")

    # -------------------------------------------------------------------------
    # HELPERS
    # -------------------------------------------------------------------------

    def _get_batches(self):
        ''' Retrieve the account.move to pay from the context and group them into batches using
        the '_get_move_batch_key' method.
        :return: A list of batches, each one containing:
            * key_values:   The key as a dictionary returned by '_get_move_batch_key'.
            * moves:        An account.move recordset.
        '''
        self.ensure_one()

        lines = self.line_ids

        if len(lines.company_id) > 1:
            raise UserError(_("You can't create payments for entries belonging to different companies."))
        if not lines:
            raise UserError(_("You can't open the register payment wizard without at least one receivable/payable line."))

        batches = {}
        for line in lines:
            batch_key = {
                'partner_id': line.partner_id.id,
                'account_id': line.account_id.id,
                'currency_id': (line.currency_id or line.company_currency_id).id,
                'partner_bank_id': line.move_id.partner_bank_id.id,
                'partner_type': 'customer' if line.account_internal_type == 'receivable' else 'supplier',
                'payment_type': 'inbound' if line.balance > 0.0 else 'outbound',
            }
            serialized_key = '-'.join(str(v) for v in batch_key.values())
            batches.setdefault(serialized_key, {
                'key_values': batch_key,
                'lines': self.env['account.move.line'],
            })
            batches[serialized_key]['lines'] += line
        return list(batches.values())

    @api.model
    def _get_wizard_values_from_batch(self, batch_result):
        ''' Extract values from the batch passed as parameter (see '_get_batches')
        to be mounted in the wizard view.
        :param batch_result:    A batch returned by '_get_batches'.
        :return:                A dictionary containing valid fields
        '''
        key_values = batch_result['key_values']
        lines = batch_result['lines']
        company = lines[0].company_id

        source_amount = abs(sum(lines.mapped('amount_residual')))
        if key_values['currency_id'] == company.currency_id.id:
            source_amount_currency = source_amount
        else:
            source_amount_currency = abs(sum(lines.mapped('amount_residual_currency')))

        return {
            'company_id': company.id,
            'partner_id': key_values['partner_id'],
            'partner_bank_id': key_values['partner_bank_id'],
            'partner_type': key_values['partner_type'],
            'payment_type': key_values['payment_type'],
            'source_currency_id': key_values['currency_id'],
            'source_amount': source_amount,
            'source_amount_currency': source_amount_currency,
        }

    @api.model
    def _get_batch_communication(self, batch_result):
        ''' Helper to compute the communication based on the batch.
        :param batch_result:    A batch returned by '_get_batches'.
        :return:                A string representing a communication to be set on payment.
        '''
        return ' '.join(label for label in batch_result['lines'].mapped('name') if label)

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    @api.depends('line_ids')
    def _compute_from_lines(self):
        ''' Load initial values from the account.moves passed through the context. '''
        for pay in self:
            batches = pay._get_batches()

            if len(batches) == 1:
                # == Single batch to be mounted on the view ==
                batch_result = batches[0]
                pay.update(pay._get_wizard_values_from_batch(batch_result))

                if len(batch_result['lines']) == 1:
                    pay.wizard_mode = 'single_line'
                else:
                    pay.wizard_mode = 'single_batch'
            else:
                # == Multiple batches: The wizard is not editable  ==
                pay.update({
                    'company_id': batches[0]['lines'][0].company_id.id,
                    'partner_id': False,
                    'partner_bank_id': False,
                    'partner_type': False,
                    'payment_type': False,
                    'source_currency_id': False,
                    'source_amount': False,
                    'source_amount_currency': False,
                    'communication': False,
                })

                if all(len(batch_result['lines']) == 1 for batch_result in batches):
                    pay.wizard_mode = 'one_per_batch'
                else:
                    pay.wizard_mode = 'multi_batches'

    @api.depends('wizard_mode')
    def _compute_communication(self):
        for pay in self:
            if pay.wizard_mode in ('single_line', 'single_batch'):
                batches = self._get_batches()
                pay.communication = pay._get_batch_communication(batches[0])
            else:
                pay.communication = False

    @api.depends('wizard_mode')
    def _compute_group_payment(self):
        for pay in self:
            if pay.wizard_mode == 'single_batch':
                batches = self._get_batches()
                pay.group_payment = len(batches[0]['lines'].move_id) == 1
            else:
                pay.group_payment = False

    @api.depends('company_id', 'source_currency_id')
    def _compute_journal_id(self):
        for pay in self:
            domain = [
                ('type', 'in', ('bank', 'cash')),
                ('company_id', '=', pay.company_id.id),
            ]
            journal = None
            if pay.source_currency_id:
                journal = self.env['account.journal'].search(domain + [('currency_id', '=', pay.source_currency_id.id)], limit=1)
            if not journal:
                journal = self.env['account.journal'].search(domain, limit=1)
            pay.journal_id = journal

    @api.depends('journal_id')
    def _compute_currency_id(self):
        for pay in self:
            pay.currency_id = pay.journal_id.currency_id or pay.source_currency_id or pay.company_id.currency_id

    @api.depends('partner_id')
    def _compute_partner_bank_id(self):
        ''' The default partner_bank_id will be the first available on the partner. '''
        for pay in self:
            available_partner_bank_accounts = pay.partner_id.bank_ids
            if available_partner_bank_accounts:
                pay.partner_bank_id = available_partner_bank_accounts[0]._origin
            else:
                pay.partner_bank_id = False

    @api.depends('wizard_mode', 'journal_id')
    def _compute_payment_method_id(self):
        for pay in self:
            batches = self._get_batches()
            payment_type = batches[0]['key_values']['payment_type']

            if payment_type == 'inbound':
                available_payment_methods = pay.journal_id.inbound_payment_method_ids
            else:
                available_payment_methods = pay.journal_id.outbound_payment_method_ids

            # Select the first available one by default.
            if available_payment_methods:
                pay.payment_method_id = available_payment_methods[0]._origin
            else:
                pay.payment_method_id = False

    @api.depends('payment_type',
                 'journal_id.inbound_payment_method_ids',
                 'journal_id.outbound_payment_method_ids')
    def _compute_payment_method_fields(self):
        for pay in self:
            if pay.payment_type == 'inbound':
                pay.available_payment_method_ids = pay.journal_id.inbound_payment_method_ids
            else:
                pay.available_payment_method_ids = pay.journal_id.outbound_payment_method_ids

            pay.hide_payment_method = len(pay.available_payment_method_ids) == 1 and pay.available_payment_method_ids.code == 'manual'

    @api.depends('payment_type',
                 'journal_id.inbound_payment_method_ids',
                 'journal_id.outbound_payment_method_ids')
    def _compute_payment_method_id(self):
        for pay in self:
            if pay.payment_type == 'inbound':
                available_payment_methods = pay.journal_id.inbound_payment_method_ids
            else:
                available_payment_methods = pay.journal_id.outbound_payment_method_ids

            # Select the first available one by default.
            if available_payment_methods:
                pay.payment_method_id = available_payment_methods[0]._origin
            else:
                pay.payment_method_id = False

    @api.depends('payment_method_id')
    def _compute_show_require_partner_bank(self):
        """ Computes if the destination bank account must be displayed in the payment form view. By default, it
        won't be displayed but some modules might change that, depending on the payment type."""
        for pay in self:
            pay.show_partner_bank_account = pay.payment_method_id.code in self.env['account.payment']._get_method_codes_using_bank_account()
            pay.require_partner_bank_account = pay.payment_method_id.code in self.env['account.payment']._get_method_codes_needing_bank_account()

    @api.depends('source_amount', 'source_amount_currency', 'source_currency_id', 'company_id', 'currency_id', 'payment_date')
    def _compute_amount(self):
        for pay in self:
            if pay.source_currency_id == pay.currency_id:
                # Same currency.
                pay.amount = pay.source_amount_currency
            elif pay.currency_id == pay.company_id.currency_id:
                # Payment expressed on the company's currency.
                pay.amount = pay.source_amount
            else:
                # Foreign currency on payment different than the one set on the journal entries.
                amount_payment_currency = pay.company_id.currency_id._convert(pay.source_amount, pay.currency_id, pay.company_id, pay.payment_date)
                pay.amount = amount_payment_currency

    @api.depends('amount')
    def _compute_payment_difference(self):
        for pay in self:
            if pay.source_currency_id == pay.currency_id:
                # Same currency.
                pay.payment_difference = pay.source_amount_currency - pay.amount
            elif pay.currency_id == pay.company_id.currency_id:
                # Payment expressed on the company's currency.
                pay.payment_difference = pay.source_amount - pay.amount
            else:
                # Foreign currency on payment different than the one set on the journal entries.
                amount_payment_currency = pay.company_id.currency_id._convert(pay.source_amount, pay.currency_id, pay.company_id, pay.payment_date)
                pay.payment_difference = amount_payment_currency - pay.amount

    # -------------------------------------------------------------------------
    # LOW-LEVEL METHODS
    # -------------------------------------------------------------------------
    
    @api.model
    def default_get(self, fields_list):
        # OVERRIDE
        res = super().default_get(fields_list)
        
        if 'line_ids' in fields_list and 'line_ids' not in res:

            # Retrieve moves to pay from the context.

            if self._context.get('active_model') == 'account.move':
                lines = self.env['account.move'].browse(self._context.get('active_ids', [])).line_ids
            elif self._context.get('active_model') == 'account.move.line':
                lines = self.env['account.move.line'].browse(self._context.get('active_ids', []))
            else:
                raise UserError(_(
                    "The register payment wizard should only be called on account.move or account.move.line records."
                ))

            # Keep lines having a residual amount to pay.
            available_lines = self.env['account.move.line']
            for line in lines:
                if line.move_id.state != 'posted':
                    raise UserError(_("You can only register payment for posted journal entries."))

                if line.account_internal_type not in ('receivable', 'payable'):
                    continue
                if line.currency_id:
                    if line.currency_id.is_zero(line.amount_residual_currency):
                        continue
                else:
                    if line.company_currency_id.is_zero(line.amount_residual):
                        continue
                available_lines |= line

            # Check.
            if not available_lines:
                raise UserError(_(
                    "You can't register a payment because there is not residual amount to pay landing on a "
                    "receivable/payable account."
                ))
            if len(lines.company_id) > 1:
                raise UserError(_("You can't create payments for entries belonging to different companies."))
            if len(set(available_lines.mapped('account_internal_type'))) > 1:
                raise UserError(_("You can only register at the same time for payment that are all inbound or all outbound"))

            res['line_ids'] = [(6, 0, available_lines.ids)]
        
        return res

    # -------------------------------------------------------------------------
    # BUSINESS METHODS
    # -------------------------------------------------------------------------

    def _create_payment_vals_from_wizard(self):
        payment_vals = {
            'date': self.payment_date,
            'amount': self.amount,
            'payment_type': self.payment_type,
            'partner_type': self.partner_type,
            'ref': self.communication,
            'journal_id': self.journal_id.id,
            'currency_id': self.currency_id.id,
            'partner_id': self.partner_id.id,
            'partner_bank_id': self.partner_bank_id.id,
            'payment_method_id': self.payment_method_id.id,
        }

        if self.payment_difference and self.payment_difference_handling == 'reconcile':
            payment_vals['write_off_line_vals'] = {
                'name': self.writeoff_label,
                'amount': -self.payment_difference,
                'account_id': self.writeoff_account_id.id,
            }
        return payment_vals

    def _create_payment_vals_from_batch(self, batch_result):
        batch_values = self._get_wizard_values_from_batch(batch_result)
        return {
            'date': self.payment_date,
            'amount': batch_values['source_amount_currency'],
            'payment_type': batch_values['payment_type'],
            'partner_type': batch_values['partner_type'],
            'ref': self._get_batch_communication(batch_result),
            'journal_id': self.journal_id.id,
            'currency_id': batch_values['source_currency_id'],
            'partner_id': batch_values['partner_id'],
            'partner_bank_id': batch_values['partner_bank_id'],
        }

    def _create_payments(self):
        self.ensure_one()
        batches = self._get_batches()

        to_reconcile = []
        if self.wizard_mode == 'single_line' or (self.wizard_mode == 'single_batch' and self.group_payment):
            payment_vals = self._create_payment_vals_from_wizard()
            payment_vals_list = [payment_vals]
            to_reconcile.append(batches[0]['lines'])
        else:
            # Don't group payments: Create one batch per move.
            if not self.group_payment:
                new_batches = []
                for batch_result in batches:
                    for line in batch_result['lines']:
                        new_batches.append({
                            **batch_result,
                            'lines': line,
                        })
                batches = new_batches

            payment_vals_list = []
            for batch_result in batches:
                payment_vals_list.append(self._create_payment_vals_from_batch(batch_result))
                to_reconcile.append(batch_result['lines'])

        payments = self.env['account.payment'].create(payment_vals_list)
        payments.action_post()

        domain = [('account_internal_type', 'in', ('receivable', 'payable')), ('reconciled', '=', False)]
        for payment, lines in zip(payments, to_reconcile):
            payment_lines = payment.line_ids.filtered_domain(domain)
            for account in payment_lines.account_id:
                (payment_lines + lines)\
                    .filtered_domain([('account_id', '=', account.id), ('reconciled', '=', False)])\
                    .reconcile()

        return payments

    def action_create_payments(self):
        payments = self._create_payments()

        action = {
            'name': _('Payments'),
            'type': 'ir.actions.act_window',
            'res_model': 'account.payment',
            'context': {'create': False},
        }
        if len(payments) == 1:
            action.update({
                'view_mode': 'form',
                'res_id': payments.id,
            })
        else:
            action.update({
                'view_mode': 'tree,form',
                'domain': [('id', 'in', payments.ids)],
            })
        return action
