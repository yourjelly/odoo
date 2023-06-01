# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime
from freezegun import freeze_time
import logging
import os
from pytz import timezone

from odoo import Command

from odoo.tests import tagged
from odoo.tools import misc

from .common import TestSaEdiCommon

_logger = logging.getLogger(__name__)


@tagged('post_install_l10n', '-at_install', 'post_install')
class TestEdiZatca(TestSaEdiCommon):

    def testInvoiceStandard(self):

        with freeze_time(self.frozen_date):

            applied_xpath = '''
                <xpath expr="(//*[local-name()='Contact']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='Invoice']/*[local-name()='UUID'])[1]" position="replace">
                    <UUID>___ignore___</UUID>
                </xpath>
                <xpath expr="(//*[local-name()='Contact']/*[local-name()='ID'])[2]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="//*[local-name()='InvoiceLine']/*[local-name()='ID']" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                '''

            standard_invoice = misc.file_open(os.path.join('l10n_sa_edi', 'tests', 'compliance', 'standard', 'invoice.xml')).read()
            expected_tree = self.get_xml_tree_from_string(standard_invoice)
            expected_tree = self.with_applied_xpath(expected_tree, applied_xpath)

            move = self._create_invoice()
            move.action_post()
            move._l10n_sa_generate_unsigned_data()
            generated_file = self.env['account.edi.format']._l10n_sa_generate_zatca_template(move)
            current_tree = self.get_xml_tree_from_string(generated_file)
            current_tree = self.with_applied_xpath(current_tree, self.remove_ubl_extensions_xpath)

            self.assertXmlTreeEqual(current_tree, expected_tree)

    def testCreditNoteStandard(self):

        with freeze_time(datetime(year=2022, month=9, day=5, hour=9, minute=39, second=15, tzinfo=timezone('Etc/GMT-3'))):

            applied_xpath = '''
                <xpath expr="(//*[local-name()='Invoice']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='Invoice']/*[local-name()='UUID'])[1]" position="replace">
                    <UUID>___ignore___</UUID>
                </xpath>
                <xpath expr="(//*[local-name()='OrderReference']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='InvoiceDocumentReference']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='AdditionalDocumentReference']/*[local-name()='UUID'])[1]" position="replace">
                    <UUID>___ignore___</UUID>
                </xpath>
                <xpath expr="(//*[local-name()='Contact']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='Contact']/*[local-name()='ID'])[2]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='PaymentMeans']/*[local-name()='InstructionNote'])" position="replace">
                    <InstructionNote>___ignore___</InstructionNote>
                </xpath>
                <xpath expr="(//*[local-name()='PaymentMeans']/*[local-name()='PaymentID'])" position="replace">
                    <PaymentID>___ignore___</PaymentID>
                </xpath>
                <xpath expr="//*[local-name()='InvoiceLine']/*[local-name()='ID']" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                '''

            standard_credit_note = misc.file_open(os.path.join('l10n_sa_edi', 'tests', 'compliance', 'standard', 'credit.xml')).read()
            expected_tree = self.get_xml_tree_from_string(standard_credit_note)
            expected_tree = self.with_applied_xpath(expected_tree, applied_xpath)

            credit_note = self._create_credit_note()
            credit_note.action_post()
            credit_note._l10n_sa_generate_unsigned_data()
            generated_file = self.env['account.edi.format']._l10n_sa_generate_zatca_template(credit_note)
            current_tree = self.get_xml_tree_from_string(generated_file)
            current_tree = self.with_applied_xpath(current_tree, self.remove_ubl_extensions_xpath)

            self.assertXmlTreeEqual(current_tree, expected_tree)

    def testDebitNoteStandard(self):
        with freeze_time(datetime(year=2022, month=9, day=5, hour=9, minute=45, second=27, tzinfo=timezone('Etc/GMT-3'))):

            applied_xpath = '''
                <xpath expr="(//*[local-name()='Invoice']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='Invoice']/*[local-name()='UUID'])[1]" position="replace">
                    <UUID>___ignore___</UUID>
                </xpath>
                <xpath expr="(//*[local-name()='OrderReference']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='InvoiceDocumentReference']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='AdditionalDocumentReference']/*[local-name()='UUID'])[1]" position="replace">
                    <UUID>___ignore___</UUID>
                </xpath>
                <xpath expr="(//*[local-name()='Contact']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='Contact']/*[local-name()='ID'])[2]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="//*[local-name()='InvoiceLine']/*[local-name()='ID']" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="//*[local-name()='PaymentMeans']/*[local-name()='InstructionID']" position="replace">
                    <InstructionID>___ignore___</InstructionID>
                </xpath>
                <xpath expr="(//*[local-name()='PaymentMeans']/*[local-name()='PaymentID'])" position="replace">
                    <PaymentID>___ignore___</PaymentID>
                </xpath>
                '''

            standard_debit_note = misc.file_open(os.path.join('l10n_sa_edi', 'tests', 'compliance', 'standard', 'debit.xml')).read()
            expected_tree = self.get_xml_tree_from_string(standard_debit_note)
            expected_tree = self.with_applied_xpath(expected_tree, applied_xpath)

            debit_note = self._create_debit_note(name='INV/2022/00015',
                invoice_line_ids=[Command.create({
                    'product_id': self.product_b.id,
                    'price_unit': 15.80,
                    'tax_ids': [Command.set(self.tax_15.ids)]})]
                )
            debit_note.action_post()
            debit_note._l10n_sa_generate_unsigned_data()
            generated_file = self.env['account.edi.format']._l10n_sa_generate_zatca_template(debit_note)
            current_tree = self.get_xml_tree_from_string(generated_file)
            current_tree = self.with_applied_xpath(current_tree, self.remove_ubl_extensions_xpath)

            self.assertXmlTreeEqual(current_tree, expected_tree)
