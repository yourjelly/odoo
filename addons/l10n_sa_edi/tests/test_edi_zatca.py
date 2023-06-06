# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime
from freezegun import freeze_time
import logging
from pytz import timezone

from odoo.modules.module import get_module_resource
from odoo.tests import tagged
from odoo.tools import misc

from .common import TestSaEdiCommon

_logger = logging.getLogger(__name__)


@tagged('post_install_l10n', '-at_install', 'post_install')
class TestEdiZatca(TestSaEdiCommon):

    def testInvoiceStandard(self):

        with freeze_time(datetime(year=2022, month=9, day=5, hour=8, minute=20, second=2, tzinfo=timezone('Etc/GMT-3'))):

            applied_xpath = '''
                <xpath expr="(//*[local-name()='Contact']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='Invoice']/*[local-name()='UUID'])[1]" position="replace">
                    <UUID>___ignore___</UUID>
                </xpath>
                <xpath expr="(//*[local-name()='Invoice']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='Contact']/*[local-name()='ID'])[2]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="//*[local-name()='InvoiceLine']/*[local-name()='ID']" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='PaymentMeans']/*[local-name()='PaymentID'])" position="replace">
                    <PaymentID>___ignore___</PaymentID>
                </xpath>
                <xpath expr="//*[local-name()='PaymentMeans']/*[local-name()='InstructionID']" position="replace">
                    <InstructionID>___ignore___</InstructionID>
                </xpath>
                '''

            file_path = get_module_resource('l10n_sa_edi', 'tests/compliance/standard', 'invoice.xml')
            standard_invoice = misc.file_open(file_path).read()
            expected_tree = self.get_xml_tree_from_string(standard_invoice)
            expected_tree = self.with_applied_xpath(expected_tree, applied_xpath)

            move = self._create_invoice(name='INV/2022/00014',date='2022-09-05',date_due='2022-09-22',partner_id=self.partner_us,product_id=self.product_a,price=320.0)
            move._l10n_sa_generate_unsigned_data()
            generated_file = self.env['account.edi.format']._l10n_sa_generate_zatca_template(move)
            current_tree = self.get_xml_tree_from_string(generated_file)
            current_tree = self.with_applied_xpath(current_tree, self.remove_ubl_extensions_xpath)

            with open('/home/odoo/Desktop/current.xml', 'wb') as f:
                current_tree.getroottree().write(f)


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

            file_path = get_module_resource('l10n_sa_edi', 'tests/compliance/standard', 'credit.xml')
            standard_credit_note = misc.file_open(file_path).read()
            expected_tree = self.get_xml_tree_from_string(standard_credit_note)
            expected_tree = self.with_applied_xpath(expected_tree, applied_xpath)

            credit_note = self._create_credit_note(name='INV/2022/00014',date='2022-09-05',date_due='2022-09-22',partner_id=self.partner_us,product_id=self.product_a,price=320.0)
            credit_note._l10n_sa_generate_unsigned_data()
            generated_file = self.env['account.edi.format']._l10n_sa_generate_zatca_template(credit_note)
            current_tree = self.get_xml_tree_from_string(generated_file)
            current_tree = self.with_applied_xpath(current_tree, self.remove_ubl_extensions_xpath)

            with open('/home/odoo/Desktop/current.xml', 'wb') as f:
                current_tree.getroottree().write(f)

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
                <xpath expr="(//*[local-name()='PaymentMeans']/*[local-name()='InstructionNote'])" position="replace">
                    <InstructionNote>___ignore___</InstructionNote>
                </xpath>
                '''

            file_path = get_module_resource('l10n_sa_edi', 'tests/compliance/standard', 'debit.xml')
            standard_debit_note = misc.file_open(file_path).read()
            expected_tree = self.get_xml_tree_from_string(standard_debit_note)
            expected_tree = self.with_applied_xpath(expected_tree, applied_xpath)

            debit_note = self._create_debit_note(name='INV/2022/00001',date='2022-09-05',date_due='2022-09-22',partner_id=self.partner_us,product_id=self.product_b,price=15.80)
            debit_note._l10n_sa_generate_unsigned_data()
            generated_file = self.env['account.edi.format']._l10n_sa_generate_zatca_template(debit_note)
            current_tree = self.get_xml_tree_from_string(generated_file)
            current_tree = self.with_applied_xpath(current_tree, self.remove_ubl_extensions_xpath)

            self.assertXmlTreeEqual(current_tree, expected_tree)

    def testInvoiceSimplified(self):
        with freeze_time(datetime(year=2023, month=3, day=10, hour=14, minute=56, second=55, tzinfo=timezone('Etc/GMT-3'))):
            applied_xpath = '''
                <xpath expr="(//*[local-name()='Invoice']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='Invoice']/*[local-name()='UUID'])[1]" position="replace">
                    <UUID>___ignore___</UUID>
                </xpath>
                <xpath expr="(//*[local-name()='Contact']/*[local-name()='ID'])[1]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="(//*[local-name()='Contact']/*[local-name()='ID'])[2]" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                <xpath expr="//*[local-name()='PaymentMeans']/*[local-name()='InstructionID']" position="replace">
                    <InstructionID>___ignore___</InstructionID>
                </xpath>
                <xpath expr="(//*[local-name()='PaymentMeans']/*[local-name()='PaymentID'])" position="replace">
                    <PaymentID>___ignore___</PaymentID>
                </xpath>
                <xpath expr="//*[local-name()='InvoiceLine']/*[local-name()='ID']" position="replace">
                    <ID>___ignore___</ID>
                </xpath>
                '''

            file_path = get_module_resource('l10n_sa_edi', 'tests/compliance/simplified', 'invoice.xml')
            standard_invoice = misc.file_open(file_path).read()
            expected_tree = self.get_xml_tree_from_string(standard_invoice)
            expected_tree = self.with_applied_xpath(expected_tree, applied_xpath)

            move = self._create_invoice(name='INV/2023/00034',date='2023-03-10',date_due='2023-03-10',partner_id=self.partner_sa_simplified,product_id=self.product_burger,price=265.00,quantity=3.0)
            move._l10n_sa_generate_unsigned_data()
            generated_file = self.env['account.edi.format']._l10n_sa_generate_zatca_template(move)
            current_tree = self.get_xml_tree_from_string(generated_file)
            current_tree = self.with_applied_xpath(current_tree, self.remove_ubl_extensions_xpath)

            with open('/home/odoo/Desktop/current.xml', 'wb') as f:
                current_tree.getroottree().write(f)

            self.assertXmlTreeEqual(current_tree, expected_tree)

    def testCreditNoteSimplified(self):
        pass

    def testDebitNoteSimplified(self):
        pass
