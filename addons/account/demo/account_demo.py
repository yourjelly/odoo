# -*- coding: utf-8 -*-
import logging
import time
from datetime import timedelta
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, Command
from odoo.tools.misc import file_open

_logger = logging.getLogger(__name__)


class AccountChartTemplate(models.AbstractModel):
    _inherit = "account.chart.template"

    @api.model
    def _get_demo_data(self, company=None):
        """Generate the demo data related to accounting."""
        # This is a generator because data created here might be referenced by xml_id to data
        # created later but defined in this same function.
        yield self._get_demo_data_move(company)
        yield self._get_demo_data_statement(company)
        yield self._get_demo_data_reconcile_model(company)
        yield self._get_demo_data_attachment(company)
        yield self._get_demo_data_mail_message(company)
        yield self._get_demo_data_mail_activity(company)

    @api.model
    def _get_demo_data_move(self, company=None):
        cid = (company or self.env.company).id
        return ('account.move', {
            f'{cid}_demo_invoice_1': {
                'move_type': 'out_invoice',
                'partner_id': 'base.res_partner_12',
                'invoice_user_id': 'base.user_demo',
                'invoice_payment_term_id': 'account.account_payment_term_end_following_month',
                'invoice_date': time.strftime('%Y-%m-01'),
                'invoice_line_ids': [
                    Command.create({'product_id': 'product.consu_delivery_02', 'quantity': 5}),
                    Command.create({'product_id': 'product.consu_delivery_03', 'quantity': 5}),
                ],
            },
            f'{cid}_demo_invoice_2': {
                'move_type': 'out_invoice',
                'partner_id': 'base.res_partner_2',
                'invoice_user_id': False,
                'invoice_date': time.strftime('%Y-%m-08'),
                'invoice_line_ids': [
                    Command.create({'product_id': 'product.consu_delivery_03', 'quantity': 5}),
                    Command.create({'product_id': 'product.consu_delivery_01', 'quantity': 20}),
                ],
            },
            f'{cid}_demo_invoice_3': {
                'move_type': 'out_invoice',
                'partner_id': 'base.res_partner_2',
                'invoice_user_id': False,
                'invoice_date': time.strftime('%Y-%m-08'),
                'invoice_line_ids': [
                    Command.create({'product_id': 'product.consu_delivery_01', 'quantity': 5}),
                    Command.create({'product_id': 'product.consu_delivery_03', 'quantity': 5}),
                ],
            },
            f'{cid}_demo_invoice_followup': {
                'move_type': 'out_invoice',
                'partner_id': 'base.res_partner_2',
                'invoice_user_id': 'base.user_demo',
                'invoice_payment_term_id': 'account.account_payment_term_immediate',
                'invoice_date': (fields.Date.today() + timedelta(days=-15)).strftime('%Y-%m-%d'),
                'invoice_line_ids': [
                    Command.create({'product_id': 'product.consu_delivery_02', 'quantity': 5}),
                    Command.create({'product_id': 'product.consu_delivery_03', 'quantity': 5}),
                ],
            },
            f'{cid}_demo_invoice_5': {
                'move_type': 'in_invoice',
                'partner_id': 'base.res_partner_12',
                'invoice_user_id': 'base.user_demo',
                'invoice_payment_term_id': 'account.account_payment_term_end_following_month',
                'invoice_date': time.strftime('%Y-%m-01'),
                'invoice_line_ids': [
                    Command.create({'product_id': 'product.product_delivery_01', 'price_unit': 10.0, 'quantity': 1}),
                    Command.create({'product_id': 'product.product_order_01', 'price_unit': 4.0, 'quantity': 5}),
                ],
            },
            f'{cid}_demo_invoice_extract': {
                'move_type': 'in_invoice',
                'invoice_user_id': 'base.user_demo',
            },
            f'{cid}_demo_invoice_equipment_purchase': {
                'move_type': 'in_invoice',
                'ref': 'INV/2018/0057',
                'partner_id': 'base.res_partner_12',
                'invoice_user_id': False,
                'invoice_date': '2018-09-17',
                'invoice_line_ids': [
                    Command.create({'name': 'Redeem Reference Number: PO02529', 'quantity': 1, 'price_unit': 541.10}),
                ],
            },
        })

    @api.model
    def _get_demo_data_statement(self, company=None):
        cid = (company or self.env.company).id
        return ('account.bank.statement', {
            f'{cid}_demo_bank_statement_1': {
                'journal_id': self.env['account.journal'].search([
                    ('type', '=', 'bank'),
                    ('company_id', '=', cid),
                ], limit=1).id,
                'date': time.strftime('%Y')+'-01-01',
                'balance_end_real': 9944.87,
                'balance_start': 5103.0,
                'line_ids': [
                    Command.create({
                        'payment_ref': time.strftime('INV/%Y/00002 and INV/%Y/00003'),
                        'amount': 1275.0,
                        'date': time.strftime('%Y-01-01'),
                        'partner_id': 'base.res_partner_12'
                    }),
                    Command.create({
                        'payment_ref': 'Bank Fees',
                        'amount': -32.58,
                        'date': time.strftime('%Y-01-01'),
                    }),
                    Command.create({
                        'payment_ref': 'Prepayment',
                        'amount': 650,
                        'date': time.strftime('%Y-01-01'),
                        'partner_id': 'base.res_partner_12'
                    }),
                    Command.create({
                        'payment_ref': time.strftime('First 2000 $ of invoice %Y/00001'),
                        'amount': 2000,
                        'date': time.strftime('%Y-01-01'),
                        'partner_id': 'base.res_partner_12'
                    }),
                    Command.create({
                        'payment_ref': 'Last Year Interests',
                        'amount': 102.78,
                        'date': time.strftime('%Y-01-01'),
                    }),
                    Command.create({
                        'payment_ref': time.strftime('INV/%Y/00002'),
                        'amount': 750,
                        'date': time.strftime('%Y-01-01'),
                        'partner_id': 'base.res_partner_2'
                    }),
                    Command.create({
                        'payment_ref': 'R:9772938  10/07 AX 9415116318 T:5 BRT: 100,00€ C/ croip',
                        'amount': 96.67,
                        'date': time.strftime('%Y-01-01'),
                        'partner_id': 'base.res_partner_2'
                    }),
                ]
            },
        })

    @api.model
    def _get_demo_data_reconcile_model(self, company=None):
        cid = (company or self.env.company).id
        return ('account.reconcile.model', {
            f'{cid}_reconcile_from_label': {
                'name': 'Line with Bank Fees',
                'rule_type': 'writeoff_suggestion',
                'match_label': 'contains',
                'match_label_param': 'BRT',
                'decimal_separator': ',',
                'line_ids': [
                    Command.create({
                        'label': 'Due amount',
                        'account_id': self._get_demo_account(
                            'income',
                            'income',
                            self.env.company,
                        ).id,
                        'amount_type': 'regex',
                        'amount_string': r'BRT: ([\d,]+)',
                    }),
                    Command.create({
                        'label': 'Bank Fees',
                        'account_id': self._get_demo_account(
                            'cost_of_goods_sold',
                            'expense_direct_cost',
                            self.env.company,
                        ).id,
                        'amount_type': 'percentage',
                        'amount_string': '100',
                    }),
                ]
            },
        })

    @api.model
    def _get_demo_data_attachment(self, company=None):
        cid = (company or self.env.company).id
        return ('ir.attachment', {
            f'{cid}_ir_attachment_bank_statement_1': {
                'type': 'binary',
                'name': 'bank_statement_yourcompany_demo.pdf',
                'res_model': 'account.bank.statement',
                'res_id': f'account.{cid}_demo_bank_statement_1',
                'raw': file_open(
                    'account/static/demo/bank_statement_yourcompany_1.pdf', 'rb'
                ).read()
            },
            f'{cid}_ir_attachment_in_invoice_1': {
                'type': 'binary',
                'name': 'in_invoice_yourcompany_demo.pdf',
                'res_model': 'account.move',
                'res_id': f'account.{cid}_demo_invoice_extract',
                'raw': file_open(
                    'account/static/demo/in_invoice_yourcompany_demo_1.pdf', 'rb'
                ).read()
            },
            f'{cid}_ir_attachment_in_invoice_2': {
                'type': 'binary',
                'name': 'in_invoice_yourcompany_demo.pdf',
                'res_model': 'account.move',
                'res_id': f'account.{cid}_demo_invoice_equipment_purchase',
                'raw': file_open(
                    'account/static/demo/in_invoice_yourcompany_demo_2.pdf', 'rb'
                ).read()
            },
        })

    @api.model
    def _get_demo_data_mail_message(self, company=None):
        cid = (company or self.env.company).id
        return ('mail.message', {
            f'{cid}_mail_message_bank_statement_1': {
                'model': 'account.bank.statement',
                'res_id': f'account.{cid}_demo_bank_statement_1',
                'body': 'Bank statement attachment',
                'message_type': 'comment',
                'author_id': 'base.partner_demo',
                'attachment_ids': [Command.set([
                    f'account.{cid}_ir_attachment_bank_statement_1'
                ])]
            },
            f'{cid}_mail_message_in_invoice_1': {
                'model': 'account.move',
                'res_id': f'account.{cid}_demo_invoice_extract',
                'body': 'Vendor Bill attachment',
                'message_type': 'comment',
                'author_id': 'base.partner_demo',
                'attachment_ids': [Command.set([
                    f'account.{cid}_ir_attachment_in_invoice_1'
                ])]
            },
            f'{cid}_mail_message_in_invoice_2': {
                'model': 'account.move',
                'res_id': f'account.{cid}_demo_invoice_equipment_purchase',
                'body': 'Vendor Bill attachment',
                'message_type': 'comment',
                'author_id': 'base.partner_demo',
                'attachment_ids': [Command.set([
                    f'account.{cid}_ir_attachment_in_invoice_2'
                ])]
            },
        })

    @api.model
    def _get_demo_data_mail_activity(self, company=None):
        cid = (company or self.env.company).id
        return ('mail.activity', {
            f'{cid}_invoice_activity_1': {
                'res_id': f'account.{cid}_demo_invoice_3',
                'res_model_id': 'account.model_account_move',
                'activity_type_id': 'mail.mail_activity_data_todo',
                'date_deadline': (fields.Datetime.today() + relativedelta(days=5)).strftime('%Y-%m-%d %H:%M'),
                'summary': 'Follow-up on payment',
                'create_uid': 'base.user_admin',
                'user_id': 'base.user_admin',
            },
            f'{cid}_invoice_activity_2': {
                'res_id': f'account.{cid}_demo_invoice_2',
                'res_model_id': 'account.model_account_move',
                'activity_type_id': 'mail.mail_activity_data_call',
                'date_deadline': fields.Datetime.today().strftime('%Y-%m-%d %H:%M'),
                'create_uid': 'base.user_admin',
                'user_id': 'base.user_admin',
            },
            f'{cid}_invoice_activity_3': {
                'res_id': f'account.{cid}_demo_invoice_1',
                'res_model_id': 'account.model_account_move',
                'activity_type_id': 'mail.mail_activity_data_todo',
                'date_deadline': (fields.Datetime.today() + relativedelta(days=5)).strftime('%Y-%m-%d %H:%M'),
                'summary': 'Include upsell',
                'create_uid': 'base.user_admin',
                'user_id': 'base.user_admin',
            },
            f'{cid}_invoice_activity_4': {
                'res_id': f'account.{cid}_demo_invoice_extract',
                'res_model_id': 'account.model_account_move',
                'activity_type_id': 'mail.mail_activity_data_todo',
                'date_deadline': (fields.Datetime.today() + relativedelta(days=5)).strftime('%Y-%m-%d %H:%M'),
                'summary': 'Update address',
                'create_uid': 'base.user_admin',
                'user_id': 'base.user_admin',
            },
        })

    @api.model
    def _post_create_demo_data(self, created, company=None):
        cid = (company or self.env.company).id
        if created._name == 'account.move':
            # the invoice_extract acts like a placeholder for the OCR to be ran and doesn't contain
            # any lines yet
            for move in created - self.env.ref(f'account.{cid}_demo_invoice_extract'):
                try:
                    move.action_post()
                except Exception:
                    _logger.exception('Error while posting demo data')
        elif created._name == 'account.bank.statement':
            created.button_post()

    @api.model
    def _get_demo_account(self, xml_id, account_type, company):
        """Find the most appropriate account possible for demo data creation.
        :param xml_id (str): the xml_id of the account template in the generic coa
        :param account_type (str): the full xml_id of the account type wanted
        :param company (Model<res.company>): the company for which we search the account
        :return (Model<account.account>): the most appropriate record found
        """
        return (
            self.env['account.account'].browse(self.env['ir.model.data'].sudo().search([
                ('name', '=', '%d_%s' % (company.id, xml_id)),
                ('model', '=', 'account.account'),
                ('module', '=like', 'l10n%')
            ], limit=1).res_id)
            or self.env['account.account'].search([
                ('account_type', '=', account_type),
                ('company_id', '=', company.id)
            ], limit=1)
            or self.env['account.account'].search([('company_id', '=', company.id)], limit=1)
        )
