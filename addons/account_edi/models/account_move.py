# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from collections import defaultdict
from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.tools import float_is_zero


class AccountMove(models.Model):
    _inherit = 'account.move'

    edi_document_ids = fields.One2many(
        comodel_name='account.edi.document',
        inverse_name='move_id')
    edi_state = fields.Selection(
        selection=[('to_send', 'To Send'), ('sent', 'Sent'), ('to_cancel', 'To Cancel'), ('cancelled', 'Cancelled')],
        string="Electronic invoicing",
        store=True,
        compute='_compute_edi_state',
        help='The aggregated state of all the EDIs with web-service of this move')
    edi_error_count = fields.Integer(
        compute='_compute_edi_error_count',
        help='How many EDIs are in error for this move ?')
    edi_blocking_level = fields.Selection(
        selection=[('info', 'Info'), ('warning', 'Warning'), ('error', 'Error')],
        compute='_compute_edi_error_message')
    edi_error_message = fields.Html(
        compute='_compute_edi_error_message')
    edi_web_services_to_process = fields.Text(
        compute='_compute_edi_web_services_to_process',
        help="Technical field to display the documents that will be processed by the CRON")
    edi_show_cancel_button = fields.Boolean(
        compute='_compute_edi_show_cancel_button')
    edi_show_abandon_cancel_button = fields.Boolean(
        compute='_compute_edi_show_abandon_cancel_button')

    @api.depends('edi_document_ids.state')
    def _compute_edi_state(self):
        for move in self:
            all_states = set(move.edi_document_ids.filtered(lambda d: d.edi_format_id._needs_web_services()).mapped('state'))
            if all_states == {'sent'}:
                move.edi_state = 'sent'
            elif all_states == {'cancelled'}:
                move.edi_state = 'cancelled'
            elif 'to_send' in all_states:
                move.edi_state = 'to_send'
            elif 'to_cancel' in all_states:
                move.edi_state = 'to_cancel'
            else:
                move.edi_state = False

    @api.depends('edi_document_ids.error')
    def _compute_edi_error_count(self):
        for move in self:
            move.edi_error_count = len(move.edi_document_ids.filtered(lambda d: d.error))

    @api.depends('edi_error_count', 'edi_document_ids.error', 'edi_document_ids.blocking_level')
    def _compute_edi_error_message(self):
        for move in self:
            if move.edi_error_count == 0:
                move.edi_error_message = None
                move.edi_blocking_level = None
            elif move.edi_error_count == 1:
                error_doc = move.edi_document_ids.filtered(lambda d: d.error)
                move.edi_error_message = error_doc.error
                move.edi_blocking_level = error_doc.blocking_level
            else:
                error_levels = set([doc.blocking_level for doc in move.edi_document_ids])
                if 'error' in error_levels:
                    move.edi_error_message = str(move.edi_error_count) + _(" Electronic invoicing error(s)")
                    move.edi_blocking_level = 'error'
                elif 'warning' in error_levels:
                    move.edi_error_message = str(move.edi_error_count) + _(" Electronic invoicing warning(s)")
                    move.edi_blocking_level = 'warning'
                else:
                    move.edi_error_message = str(move.edi_error_count) + _(" Electronic invoicing info(s)")
                    move.edi_blocking_level = 'info'

    @api.depends(
        'edi_document_ids',
        'edi_document_ids.state',
        'edi_document_ids.blocking_level',
        'edi_document_ids.edi_format_id',
        'edi_document_ids.edi_format_id.name')
    def _compute_edi_web_services_to_process(self):
        for move in self:
            to_process = move.edi_document_ids.filtered(lambda d: d.state in ['to_send', 'to_cancel'] and d.blocking_level != 'error')
            format_web_services = to_process.edi_format_id.filtered(lambda f: f._needs_web_services())
            move.edi_web_services_to_process = ', '.join(f.name for f in format_web_services)

    @api.depends(
        'state',
        'edi_document_ids.state')
    def _compute_show_reset_to_draft_button(self):
        # OVERRIDE
        super()._compute_show_reset_to_draft_button()

        for move in self:
            for doc in move.edi_document_ids:
                if doc.edi_format_id._needs_web_services() \
                        and doc.state in ('sent', 'to_cancel') \
                        and move.is_invoice(include_receipts=True) \
                        and doc.edi_format_id._is_required_for_invoice(move):
                    move.show_reset_to_draft_button = False
                    break

    @api.depends(
        'state',
        'edi_document_ids.state')
    def _compute_edi_show_cancel_button(self):
        for move in self:
            if move.state != 'posted':
                move.edi_show_cancel_button = False
                continue

            move.edi_show_cancel_button = any([doc.edi_format_id._needs_web_services()
                                               and doc.state == 'sent'
                                               and move.is_invoice(include_receipts=True)
                                               and doc.edi_format_id._is_required_for_invoice(move)
                                              for doc in move.edi_document_ids])

    @api.depends(
        'state',
        'edi_document_ids.state')
    def _compute_edi_show_abandon_cancel_button(self):
        for move in self:
            move.edi_show_abandon_cancel_button = any(doc.edi_format_id._needs_web_services()
                                                      and doc.state == 'to_cancel'
                                                      and move.is_invoice(include_receipts=True)
                                                      and doc.edi_format_id._is_required_for_invoice(move)
                                                      for doc in move.edi_document_ids)

    ####################################################
    # Export Electronic Document
    ####################################################

    @api.model
    def _add_edi_tax_values(self, results, grouping_key, serialized_grouping_key, tax_details, key_by_tax):
        # Add to global results.
        results['tax_amount'] += tax_details['tax_amount']
        results['tax_amount_currency'] += tax_details['tax_amount_currency']

        # Add to tax details.
        if serialized_grouping_key not in results['tax_details']:
            tax_values = results['tax_details'][serialized_grouping_key]

            tax_values.update(grouping_key)
            tax_values.update({
                'base_amount': tax_details['base_amount'],
                'base_amount_currency': tax_details['base_amount_currency'],
            })
        else:
            tax_values = results['tax_details'][serialized_grouping_key]
            if key_by_tax[tax_details['tax']] != key_by_tax.get(tax_details['src_line'].tax_line_id):
                tax_values['base_amount'] += tax_details['base_amount']
                tax_values['base_amount_currency'] += tax_details['base_amount_currency']

        tax_values['tax_amount'] += tax_details['tax_amount']
        tax_values['tax_amount_currency'] += tax_details['tax_amount_currency']
        tax_values['group_tax_details'].append(tax_details)

    @api.model
    def _prepare_edi_export_tax_grouping_key(self, code, filter_invoice_line=None, filter_tax_detail=None, grouping_key_generator=None):
        """ Use this method to define a way to compute taxes for EDI export.

        :param code:                    The unique code used to retrieve the values computed for this method.
                                        It must be unique.

        :param filter_invoice_line:     Optional filter to exclude some invoice lines.

                                        The filter is defined as a method getting an invoice line as parameter.
                                        If the filter is returning False, the invoice line is not considered.

        :param filter_tax_detail:       Optional filter to exclude some tax details.
                                        The filter is defined as a method getting a dictionary as parameter
                                        representing the tax values for a single repartition line.
                                        This dictionary contains:

            'base_line_id':             An account.move.line record.
            'tax_id':                   An account.tax record.
            'tax_repartition_line_id':  An account.tax.repartition.line record.
            'base_amount':              The tax base amount expressed in company currency.
            'tax_amount':               The tax amount expressed in company currency.
            'base_amount_currency':     The tax base amount expressed in foreign currency.
            'tax_amount_currency':      The tax amount expressed in foreign currency.

                                        If the filter is returning False, it means the current tax values will be
                                        ignored when computing the final results.

        :param grouping_key_generator:  Optional method used to group tax values together. By default, the tax values
                                        are grouped by tax. This parameter is a method getting a dictionary as parameter
                                        (same signature as 'filter_to_apply').

                                        This method must returns a dictionary where values will be used to create the
                                        grouping_key to aggregate tax values together. The returned dictionary is added
                                        to each tax details in order to retrieve the full grouping_key later.

        :return:
        """
        if not filter_invoice_line:
            filter_invoice_line = lambda x: True
        if not filter_tax_detail:
            filter_tax_detail = lambda x: True
        if not grouping_key_generator:
            grouping_key_generator = lambda x: {'tax': x['tax']}

        return {
            'code': code,
            'filter_invoice_line': filter_invoice_line,
            'filter_tax_detail': filter_tax_detail,
            'grouping_key_generator': grouping_key_generator,
        }

    def _prepare_edi_vals_to_export(self, tax_grouping_methods=[]):
        """ The purpose of this helper is to prepare values in order to export an invoice through the EDI system.
        This includes the computation of the tax details for each invoice line that could be very difficult to
        handle regarding the computation of the base amount.

        :param tax_grouping_methods:    A list of dictionaries defining how the taxes computation should be handled.
                                        The '_prepare_edi_export_tax_grouping_key' method should be use to create them.

        :return: A python dictionary containing:

            record: The invoice record.

            invoice_lines:  A map <invoice_line, dictionary> where 'dictionary' contains:

                record: The invoice line record.

                tax_details_list:   A list of python dictionaries, each one representing a tax details and containing:

                    base_line:              The invoice line record originator of taxes.
                    tax_line:               The tax line record created for a single repartition line.
                    src_line:               The generator move line of the current tax details.
                                            It could be either the base line, either a tax line affecting the base of subsequent ones.
                    tax:                    The originator tax.
                    src_tax:                Either the group of taxes, either the same record as 'tax'.
                    tax_repartition_line:   The tax repartition line.
                    base_amount:            The tax base amount in company currency.
                    tax_amount:             The tax amount in company currency.
                    base_amount_currency:   The tax base amount in foreign currency.
                    tax_amount_currency:    The tax amount in foreign currency.

                taxes:              A map <grouping_method_code, dictionary> where 'grouping_method_code' is the 'code'
                                    defined in the tax grouping methods passed as parameter into 'tax_grouping_methods'.
                                    'dictionary' contains:

                    base_amount:            The tax base amount in company currency.
                    tax_amount:             The tax amount in company currency.
                    base_amount_currency:   The tax base amount in foreign currency.
                    tax_amount_currency:    The tax amount in foreign currency.
                    tax_details:            A mapping of each grouping key (see 'grouping_key_generator') to a dictionary
                                            containing:

                        base_amount:                The tax base amount in company currency.
                        tax_amount:                 The tax amount in company currency.
                        base_amount_currency:       The tax base amount in foreign currency.
                        tax_amount_currency:        The tax amount in foreign currency.
                        group_tax_details:          The list of all tax details aggregated into this group.
                                                    See 'tax_details_list' for more details.

                totals:             A python dictionary containing some business values for the current line.
                                    All these values are sum together at the invoice level.

                        net_price_subtotal:         The total invoiced for the current line without tax, neither discount.
                        net_price_subtotal_unit:    The price unit invoiced for the current line without tax, neither
                                                    discount.
                        gross_price_subtotal:       The total invoiced for the current line without tax including the
                                                    discount.
                        gross_price_subtotal:       The price unit invoiced for the current line without tax including
                                                    discount.
                        net_price_total:            The total invoiced for the current line including taxes but without
                                                    discount.
                        net_price_total_unit:       The price unit invoiced for the current line including taxes but
                                                    without the discount.
                        gross_price_total:          The total invoiced for the current line including the taxes and the
                                                    discount.
                        gross_price_total_unit:     The price unit invoiced for the current line including the taxes and
                                                    the discount.
                        discount_amount:            The amount of the discount for the current line.

            taxes:                  Same as 'taxes' for lines but applied to the whole invoice.

            totals:                 Same as 'totals' for lines but applied to the whole invoice.

            format_float:           Helper method to format monetary values when exporting to a file like an xml.
        """
        self.ensure_one()

        def _serialize_python_dictionary(vals):
            return '-'.join(str(vals[k]) for k in sorted(vals.keys()))

        def format_float(amount, precision_digits, none_if_zero=False):
            if amount is False or amount is None:
                return None
            if none_if_zero and float_is_zero(amount, precision_digits=precision_digits):
                return None
            return '%.*f' % (precision_digits, amount)

        invoice_lines = self.invoice_line_ids.filtered(lambda line: not line.display_type)
        balance_multiplicator = -1 if self.is_inbound() else 1

        res = {
            'record': self,

            'invoice_lines': {},

            'taxes': {},

            'totals': {
                'net_price_subtotal': 0.0,
                'net_price_subtotal_unit': 0.0,
                'gross_price_subtotal': 0.0,
                'gross_price_subtotal_unit': 0.0,
                'net_price_total': 0.0,
                'net_price_total_unit': 0.0,
                'gross_price_total': 0.0,
                'gross_price_total_unit': 0.0,
                'discount_amount': 0.0,
            },

            'format_float': format_float,
        }

        # ==== Invoice lines details ====

        for invoice_line in invoice_lines:

            net_price_subtotal = invoice_line.price_subtotal
            net_price_subtotal_unit = invoice_line.currency_id.round(net_price_subtotal / invoice_line.quantity) if invoice_line.quantity else 0.0
            gross_price_subtotal = net_price_subtotal / (1.0 - ((invoice_line.discount or 0.0) / 100.0))
            gross_price_subtotal_unit = invoice_line.currency_id.round(gross_price_subtotal / invoice_line.quantity) if invoice_line.quantity else 0.0
            net_price_total = invoice_line.price_total
            net_price_total_unit = invoice_line.currency_id.round(net_price_total / invoice_line.quantity) if invoice_line.quantity else 0.0
            gross_price_total = net_price_total / (1.0 - (invoice_line.discount or 0.0) / 100.0)
            gross_price_total_unit = invoice_line.currency_id.round(gross_price_total / invoice_line.quantity) if invoice_line.quantity else 0.0

            res['invoice_lines'][invoice_line] = {
                'record': invoice_line,

                'tax_details_list': [],

                'taxes': {},

                'totals': {
                    'net_price_subtotal': net_price_subtotal,
                    'net_price_subtotal_unit': net_price_subtotal_unit,
                    'gross_price_subtotal': gross_price_subtotal,
                    'gross_price_subtotal_unit': gross_price_subtotal_unit,
                    'net_price_total': net_price_total,
                    'net_price_total_unit': net_price_total_unit,
                    'gross_price_total': gross_price_total,
                    'gross_price_total_unit': gross_price_total_unit,
                    'discount_amount': gross_price_subtotal - net_price_subtotal,
                },
            }

            # == Add to invoice totals ==

            for k, amount in res['invoice_lines'][invoice_line]['totals'].items():
                res['totals'][k] += amount

        # ==== Taxes ====

        if tax_grouping_methods:

            # == Compute the tax details ==

            domain = [('move_id', '=', self.id)]
            tax_details_query, tax_details_params = invoice_lines._get_query_tax_details_from_domain(domain)
            self._cr.execute(tax_details_query, tax_details_params)
            for row in self._cr.dictfetchall():
                invoice_line = invoice_lines.browse(row['base_line_id'])
                tax_line = invoice_lines.browse(row['tax_line_id'])
                src_line = invoice_lines.browse(row['src_line_id'])

                tax = self.env['account.tax'].browse(row['tax_id'])

                res['invoice_lines'][invoice_line]['tax_details_list'].append({
                    'base_line': invoice_line,
                    'tax_line': tax_line,
                    'src_line': src_line,
                    'tax': tax,
                    'src_tax': self.env['account.tax'].browse(row['group_tax_id']) if row['group_tax_id'] else tax,
                    'tax_repartition_line': tax_line.tax_repartition_line_id,

                    'base_amount': balance_multiplicator * row['base_amount'],
                    'tax_amount': balance_multiplicator * row['tax_amount'],
                    'base_amount_currency': balance_multiplicator * row['base_amount_currency'],
                    'tax_amount_currency': balance_multiplicator * row['tax_amount_currency'],
                })

            # == Add missing tax details for zero tax lines ==

            if self.move_type in ('out_refund', 'in_refund'):
                tax_rep_lines_field = 'refund_repartition_line_ids'
            else:
                tax_rep_lines_field = 'invoice_repartition_line_ids'

            for invoice_line in invoice_lines:
                invoice_line_vals = res['invoice_lines'][invoice_line]
                tax_details_list = invoice_line_vals['tax_details_list']

                # Search for unhandled taxes.
                taxes_set = set(invoice_line.tax_ids.flatten_taxes_hierarchy())
                for tax_details in tax_details_list:
                    taxes_set.discard(tax_details['tax'])

                # Restore zero-tax tax details.
                for zero_tax in taxes_set:

                    affect_base_amount = 0.0
                    affect_base_amount_currency = 0.0
                    for tax_details in tax_details_list:
                        if zero_tax in tax_details['tax_line'].tax_ids:
                            affect_base_amount += tax_details['tax_amount']
                            affect_base_amount_currency += tax_details['tax_amount_currency']

                    for tax_rep in zero_tax[tax_rep_lines_field].filtered(lambda x: x.repartition_type == 'tax'):
                        tax_details_list.append({
                            'base_line': invoice_line,
                            'tax_line': self.env['account.move.line'],
                            'src_line': invoice_line,
                            'tax': zero_tax,
                            'src_tax': zero_tax,
                            'tax_repartition_line': tax_rep,

                            'base_amount': (balance_multiplicator * invoice_line.balance) + affect_base_amount,
                            'tax_amount': 0.0,
                            'base_amount_currency': (balance_multiplicator * invoice_line.amount_currency) + affect_base_amount_currency,
                            'tax_amount_currency': 0.0,
                        })

            # == Add tax details to results ==

            for tax_grouping_method in tax_grouping_methods:

                invoice_global_tax_values = res['taxes'][tax_grouping_method['code']] = {
                    'base_amount': 0.0,
                    'tax_amount': 0.0,
                    'base_amount_currency': 0.0,
                    'tax_amount_currency': 0.0,
                    'tax_details': defaultdict(lambda: {
                        'base_amount': 0.0,
                        'tax_amount': 0.0,
                        'base_amount_currency': 0.0,
                        'tax_amount_currency': 0.0,
                        'group_tax_details': [],
                    }),
                }

                for invoice_line in invoice_lines:
                    if not tax_grouping_method['filter_invoice_line'](invoice_line):
                        continue

                    invoice_line_vals = res['invoice_lines'][invoice_line]
                    tax_details_list = invoice_line_vals['tax_details_list']

                    invoice_line_global_tax_values = invoice_line_vals['taxes'][tax_grouping_method['code']] = {
                        'base_amount': balance_multiplicator * invoice_line.balance,
                        'tax_amount': 0.0,
                        'base_amount_currency': balance_multiplicator * invoice_line.amount_currency,
                        'tax_amount_currency': 0.0,
                        'tax_details': defaultdict(lambda: {
                            'base_amount': 0.0,
                            'tax_amount': 0.0,
                            'base_amount_currency': 0.0,
                            'tax_amount_currency': 0.0,
                            'group_tax_details': [],
                        }),
                    }

                    invoice_global_tax_values['base_amount'] += invoice_line_global_tax_values['base_amount']
                    invoice_global_tax_values['base_amount_currency'] += invoice_line_global_tax_values['base_amount_currency']

                    # Keep track of the serialized_grouping_key for each tax.
                    # This will be used later to know which amount must be sum to compute the base amounts.
                    key_by_tax = {}

                    for tax_details in tax_details_list:

                        if not tax_grouping_method['filter_tax_detail'](tax_details):
                            continue

                        grouping_key = tax_grouping_method['grouping_key_generator'](tax_details)
                        serialized_grouping_key = _serialize_python_dictionary(grouping_key)
                        key_by_tax[tax_details['tax']] = serialized_grouping_key

                        self._add_edi_tax_values(invoice_global_tax_values, grouping_key, serialized_grouping_key, tax_details, key_by_tax)
                        self._add_edi_tax_values(invoice_line_global_tax_values, grouping_key, serialized_grouping_key, tax_details, key_by_tax)

        return res

    def _update_payments_edi_documents(self):
        ''' Update the edi documents linked to the current journal entries. These journal entries must be linked to an
        account.payment of an account.bank.statement.line. This additional method is needed because the payment flow is
        not the same as the invoice one. Indeed, the edi documents must be updated when the reconciliation with some
        invoices is changing.
        '''
        edi_document_vals_list = []
        for payment in self:
            edi_formats = payment._get_reconciled_invoices().journal_id.edi_format_ids + payment.edi_document_ids.edi_format_id
            edi_formats = self.env['account.edi.format'].browse(edi_formats.ids) # Avoid duplicates
            for edi_format in edi_formats:
                existing_edi_document = payment.edi_document_ids.filtered(lambda x: x.edi_format_id == edi_format)

                if edi_format._is_required_for_payment(payment):
                    if existing_edi_document:
                        existing_edi_document.write({
                            'state': 'to_send',
                            'error': False,
                            'blocking_level': False,
                        })
                    else:
                        edi_document_vals_list.append({
                            'edi_format_id': edi_format.id,
                            'move_id': payment.id,
                            'state': 'to_send',
                        })
                elif existing_edi_document:
                    existing_edi_document.write({
                        'state': False,
                        'error': False,
                        'blocking_level': False,
                    })

        self.env['account.edi.document'].create(edi_document_vals_list)
        self.edi_document_ids._process_documents_no_web_services()

    def _post(self, soft=True):
        # OVERRIDE
        # Set the electronic document to be posted and post immediately for synchronous formats.
        posted = super()._post(soft=soft)

        edi_document_vals_list = []
        for move in posted:
            for edi_format in move.journal_id.edi_format_ids:
                is_edi_needed = move.is_invoice(include_receipts=False) and edi_format._is_required_for_invoice(move)

                if is_edi_needed:
                    errors = edi_format._check_move_configuration(move)
                    if errors:
                        raise UserError(_("Invalid invoice configuration:\n\n%s") % '\n'.join(errors))

                    existing_edi_document = move.edi_document_ids.filtered(lambda x: x.edi_format_id == edi_format)
                    if existing_edi_document:
                        existing_edi_document.write({
                            'state': 'to_send',
                            'attachment_id': False,
                        })
                    else:
                        edi_document_vals_list.append({
                            'edi_format_id': edi_format.id,
                            'move_id': move.id,
                            'state': 'to_send',
                        })

        self.env['account.edi.document'].create(edi_document_vals_list)
        posted.edi_document_ids._process_documents_no_web_services()
        self.env.ref('account_edi.ir_cron_edi_network')._trigger()
        return posted

    def button_cancel(self):
        # OVERRIDE
        # Set the electronic document to be canceled and cancel immediately for synchronous formats.
        res = super().button_cancel()

        self.edi_document_ids.filtered(lambda doc: doc.state != 'sent').write({'state': 'cancelled', 'error': False, 'blocking_level': False})
        self.edi_document_ids.filtered(lambda doc: doc.state == 'sent').write({'state': 'to_cancel', 'error': False, 'blocking_level': False})
        self.edi_document_ids._process_documents_no_web_services()
        self.env.ref('account_edi.ir_cron_edi_network')._trigger()

        return res

    def button_draft(self):
        # OVERRIDE
        for move in self:
            if move.edi_show_cancel_button:
                raise UserError(_(
                    "You can't edit the following journal entry %s because an electronic document has already been "
                    "sent. Please use the 'Request EDI Cancellation' button instead."
                ) % move.display_name)

        res = super().button_draft()

        self.edi_document_ids.write({'error': False, 'blocking_level': False})

        return res

    def button_cancel_posted_moves(self):
        '''Mark the edi.document related to this move to be canceled.
        '''
        to_cancel_documents = self.env['account.edi.document']
        for move in self:
            is_move_marked = False
            for doc in move.edi_document_ids:
                if doc.edi_format_id._needs_web_services() \
                        and doc.attachment_id \
                        and doc.state == 'sent' \
                        and move.is_invoice(include_receipts=True) \
                        and doc.edi_format_id._is_required_for_invoice(move):
                    to_cancel_documents |= doc
                    is_move_marked = True
            if is_move_marked:
                move.message_post(body=_("A cancellation of the EDI has been requested."))

        to_cancel_documents.write({'state': 'to_cancel', 'error': False, 'blocking_level': False})

    def button_abandon_cancel_posted_posted_moves(self):
        '''Cancel the request for cancellation of the EDI.
        '''
        documents = self.env['account.edi.document']
        for move in self:
            is_move_marked = False
            for doc in move.edi_document_ids:
                if doc.state == 'to_cancel' \
                        and move.is_invoice(include_receipts=True) \
                        and doc.edi_format_id._is_required_for_invoice(move):
                    documents |= doc
                    is_move_marked = True
            if is_move_marked:
                move.message_post(body=_("A request for cancellation of the EDI has been called off."))

        documents.write({'state': 'sent'})

    def _get_edi_document(self, edi_format):
        return self.edi_document_ids.filtered(lambda d: d.edi_format_id == edi_format)

    def _get_edi_attachment(self, edi_format):
        return self._get_edi_document(edi_format).attachment_id

    ####################################################
    # Import Electronic Document
    ####################################################

    def _get_create_invoice_from_attachment_decoders(self):
        # OVERRIDE
        res = super()._get_create_invoice_from_attachment_decoders()
        res.append((10, self.env['account.edi.format'].search([])._create_invoice_from_attachment))
        return res

    def _get_update_invoice_from_attachment_decoders(self, invoice):
        # OVERRIDE
        res = super()._get_update_invoice_from_attachment_decoders(invoice)
        res.append((10, self.env['account.edi.format'].search([])._update_invoice_from_attachment))
        return res

    ####################################################
    # Business operations
    ####################################################

    def action_process_edi_web_services(self):
        docs = self.edi_document_ids.filtered(lambda d: d.state in ('to_send', 'to_cancel') and d.blocking_level != 'error')
        docs._process_documents_web_services()

    def _retry_edi_documents_error_hook(self):
        ''' Hook called when edi_documents are retried. For example, when it's needed to clean a field.
        TO OVERRIDE
        '''
        return

    def action_retry_edi_documents_error(self):
        self._retry_edi_documents_error_hook()
        self.edi_document_ids.write({'error': False, 'blocking_level': False})
        self.action_process_edi_web_services()


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    ####################################################
    # Export Electronic Document
    ####################################################

    def reconcile(self):
        # OVERRIDE
        # In some countries, the payments must be sent to the government under some condition. One of them could be
        # there is at least one reconciled invoice to the payment. Then, we need to update the state of the edi
        # documents during the reconciliation.
        all_lines = self + self.matched_debit_ids.debit_move_id + self.matched_credit_ids.credit_move_id
        payments = all_lines.move_id.filtered(lambda move: move.payment_id or move.statement_line_id)

        invoices_per_payment_before = {pay: pay._get_reconciled_invoices() for pay in payments}
        res = super().reconcile()
        invoices_per_payment_after = {pay: pay._get_reconciled_invoices() for pay in payments}

        changed_payments = self.env['account.move']
        for payment, invoices_after in invoices_per_payment_after.items():
            invoices_before = invoices_per_payment_before[payment]

            if set(invoices_after.ids) != set(invoices_before.ids):
                changed_payments |= payment
        changed_payments._update_payments_edi_documents()

        return res

    def remove_move_reconcile(self):
        # OVERRIDE
        # When a payment has been sent to the government, it usually contains some information about reconciled
        # invoices. If the user breaks a reconciliation, the related payments must be cancelled properly and then, a new
        # electronic document must be generated.
        all_lines = self + self.matched_debit_ids.debit_move_id + self.matched_credit_ids.credit_move_id
        payments = all_lines.move_id.filtered(lambda move: move.payment_id or move.statement_line_id)

        invoices_per_payment_before = {pay: pay._get_reconciled_invoices() for pay in payments}
        res = super().remove_move_reconcile()
        invoices_per_payment_after = {pay: pay._get_reconciled_invoices() for pay in payments}

        changed_payments = self.env['account.move']
        for payment, invoices_after in invoices_per_payment_after.items():
            invoices_before = invoices_per_payment_before[payment]

            if set(invoices_after.ids) != set(invoices_before.ids):
                changed_payments |= payment
        changed_payments._update_payments_edi_documents()

        return res
