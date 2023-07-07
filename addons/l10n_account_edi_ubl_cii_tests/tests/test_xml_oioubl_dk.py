# -*- coding: utf-8 -*-
import base64
from freezegun import freeze_time

from odoo import Command
from odoo.addons.l10n_account_edi_ubl_cii_tests.tests.common import TestUBLCommon
from odoo.addons.account.tests.test_account_move_send import TestAccountMoveSendCommon
from odoo.tests import tagged
from odoo.tools.misc import file_open
from lxml import etree
from pathlib import Path

def write_oioubl_xml(xml_content):
    with Path("~/Downloads/OIOUBL.xml").expanduser().open("wb") as f:
        f.write(xml_content)

@tagged('post_install_l10n', 'post_install', '-at_install')
class TestUBLDK(TestUBLCommon, TestAccountMoveSendCommon):

    @classmethod
    def setUpClass(cls, chart_template_ref="dk"):
        super().setUpClass(chart_template_ref=chart_template_ref)

        cls.company_data['company'].write({
            'country_id': cls.env.ref('base.dk').id,
            'currency_id': cls.env.ref('base.DKK').id,
            'city': 'Aalborg',
            'zip': '9430',
            'vat': 'DK12345674',
            'phone': '+45 32 12 34 56',
            'street': 'Paradisæblevej, 10',
            'invoice_is_ubl_cii': True,
        })
        cls.env['res.partner.bank'].create({
            'acc_type': 'iban',
            'partner_id': cls.company_data['company'].partner_id.id,
            'acc_number': 'DK5000400440116243',
        })

        cls.partner_a.write({
            'name': 'SUPER DANISH PARTNER',
            'city': 'Aalborg',
            'zip': '9430',
            'vat': 'DK12345674',
            'phone': '+45 32 12 35 56',
            'street': 'Paradisæblevej, 11',
            'country_id': cls.env.ref('base.dk').id,
            'ubl_cii_format': 'oioubl_201',
        })
        cls.partner_b.write({
            'name': 'SUPER BELGIAN PARTNER',
            'street': 'Rue du Paradis, 10',
            'zip': '6870',
            'city': 'Eghezee',
            'country_id': cls.env.ref('base.be').id,
            'phone': '061928374',
            'vat': 'BE0897223670',
            'ubl_cii_format': 'oioubl_201',
        })
        cls.partner_c = cls.env["res.partner"].create({
            'name': 'SUPER FRENCH PARTNER',
            'street': 'Rue Fabricy, 16',
            'zip': '59000',
            'city': 'Lille',
            'country_id': cls.env.ref('base.fr').id,
            'phone': '+33 1 23 45 67 89',
            'vat': 'FR23334175221',
            'ubl_cii_format': 'oioubl_201',
        })

    ####################################################
    # Test export - import
    ####################################################

    @freeze_time('2017-01-01')
    def test_export_invoice_one_line_schematron_partner_dk(self):
        invoice = self.env["account.move"].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'partner_bank_id': self.env.company.partner_id.bank_ids[:1].id,
            'invoice_payment_term_id': self.pay_terms_b.id,
            'invoice_date': '2017-01-01',
            'date': '2017-01-01',
            'narration': 'test narration',
            'ref': 'ref_move',
            'invoice_line_ids': [
                Command.create({
                    'product_id': self.product_a.id,
                    'quantity': 1.0,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(self.env["account.chart.template"].ref('tax110').ids)],
                }),
            ],
        })
        invoice.action_post()
        invoice._generate_pdf_and_send_invoice(self.move_template)
        self.assertTrue(invoice.ubl_cii_xml_id)
        xml_content = base64.b64decode(invoice.ubl_cii_xml_id.with_context(bin_size=False).datas)
        xml_etree = self.get_xml_tree_from_string(xml_content)

        with file_open("l10n_account_edi_ubl_cii_tests/tests/OIOUBL_Invoice_Schematron.xsl", "rb") as schematron_file:
            xsl = etree.parse(schematron_file)
            transform = etree.XSLT(xsl)
            result_tree = transform(xml_etree)

            errors = result_tree.xpath("//Error")
            err = False
            for error in errors:
                err = True
                print("")
                print("")
                print(error.xpath("//Xpath")[0].text)
                print(error.xpath("//Description")[0].text)
                print("")
                print(error.xpath("//Pattern")[0].text)
        if err:
            write_oioubl_xml(xml_content)
        self.assertFalse(err, "There is some error detected by the schematron")

    @freeze_time('2017-01-01')
    def test_export_invoice_two_line_schematron_partner_dk(self):
        invoice = self.env["account.move"].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_a.id,
            'partner_bank_id': self.env.company.partner_id.bank_ids[:1].id,
            'invoice_payment_term_id': self.pay_terms_b.id,
            'invoice_date': '2017-01-01',
            'date': '2017-01-01',
            'narration': 'test narration',
            'ref': 'ref_move',
            'invoice_line_ids': [
                Command.create({
                    'product_id': self.product_a.id,
                    'quantity': 1.0,
                    'price_unit': 500.0,
                    'tax_ids': [Command.set(self.env["account.chart.template"].ref('tax120').ids)],
                }),
                Command.create({
                    'product_id': self.product_b.id,
                    'quantity': 1.0,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(self.env["account.chart.template"].ref('tax110').ids)],
                }),
            ],
        })
        invoice.action_post()
        invoice._generate_pdf_and_send_invoice(self.move_template)
        self.assertTrue(invoice.ubl_cii_xml_id)
        xml_content = base64.b64decode(invoice.ubl_cii_xml_id.with_context(bin_size=False).datas)
        xml_etree = self.get_xml_tree_from_string(xml_content)

        with file_open("l10n_account_edi_ubl_cii_tests/tests/OIOUBL_Invoice_Schematron.xsl", "rb") as schematron_file:
            xsl = etree.parse(schematron_file)
            transform = etree.XSLT(xsl)
            result_tree = transform(xml_etree)

            errors = result_tree.xpath("//Error")
            err = False
            for error in errors:
                err = True
                print("")
                print("")
                print(error.xpath("//Xpath")[0].text)
                print(error.xpath("//Description")[0].text)
                print("")
                print(error.xpath("//Pattern")[0].text)
        if err:
            write_oioubl_xml(xml_content)
        self.assertFalse(err, "There is some error detected by the schematron")

    @freeze_time('2017-01-01')
    def test_export_invoice_two_line_schematron_foreign_partner_be(self):
        invoice = self.env["account.move"].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_b.id,
            'partner_bank_id': self.env.company.partner_id.bank_ids[:1].id,
            'invoice_payment_term_id': self.pay_terms_b.id,
            'invoice_date': '2017-01-01',
            'date': '2017-01-01',
            'narration': 'test narration',
            'ref': 'ref_move',
            'invoice_line_ids': [
                Command.create({
                    'product_id': self.product_a.id,
                    'quantity': 1.0,
                    'price_unit': 500.0,
                    'tax_ids': [Command.set(self.env["account.chart.template"].ref('tax120').ids)],
                }),
                Command.create({
                    'product_id': self.product_b.id,
                    'quantity': 1.0,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(self.env["account.chart.template"].ref('tax110').ids)],
                }),
            ],
        })
        invoice.action_post()
        invoice._generate_pdf_and_send_invoice(self.move_template)
        self.assertTrue(invoice.ubl_cii_xml_id)
        xml_content = base64.b64decode(invoice.ubl_cii_xml_id.with_context(bin_size=False).datas)
        xml_etree = self.get_xml_tree_from_string(xml_content)

        err = False
        with file_open("l10n_account_edi_ubl_cii_tests/tests/OIOUBL_Invoice_Schematron.xsl", "rb") as schematron_file:
            xsl = etree.parse(schematron_file)
            transform = etree.XSLT(xsl)
            result_tree = transform(xml_etree)

            errors = result_tree.xpath("//Error")
            for error in errors:
                err = True
                print("")
                print("")
                print(error.xpath("//Xpath")[0].text)
                print(error.xpath("//Description")[0].text)
                print("")
                print(error.xpath("//Pattern")[0].text)

        if err:
            write_oioubl_xml(xml_content)
        self.assertFalse(err, "There is some error detected by the schematron")

    @freeze_time('2017-01-01')
    def test_export_invoice_two_line_schematron_foreign_partner_fr(self):
        invoice = self.env["account.move"].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner_c.id,
            'partner_bank_id': self.env.company.partner_id.bank_ids[:1].id,
            'invoice_payment_term_id': self.pay_terms_b.id,
            'invoice_date': '2017-01-01',
            'date': '2017-01-01',
            'narration': 'test narration',
            'ref': 'ref_move',
            'invoice_line_ids': [
                Command.create({
                    'product_id': self.product_a.id,
                    'quantity': 1.0,
                    'price_unit': 500.0,
                    'tax_ids': [Command.set(self.env["account.chart.template"].ref('tax120').ids)],
                }),
                Command.create({
                    'product_id': self.product_b.id,
                    'quantity': 1.0,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(self.env["account.chart.template"].ref('tax110').ids)],
                }),
            ],
        })
        invoice.action_post()
        invoice._generate_pdf_and_send_invoice(self.move_template)
        self.assertTrue(invoice.ubl_cii_xml_id)
        xml_content = base64.b64decode(invoice.ubl_cii_xml_id.with_context(bin_size=False).datas)
        xml_etree = self.get_xml_tree_from_string(xml_content)

        err = False
        with file_open("l10n_account_edi_ubl_cii_tests/tests/OIOUBL_Invoice_Schematron.xsl", "rb") as schematron_file:
            xsl = etree.parse(schematron_file)
            transform = etree.XSLT(xsl)
            result_tree = transform(xml_etree)

            errors = result_tree.xpath("//Error")
            for error in errors:
                err = True
                print("")
                print("")
                print(error.xpath("//Xpath")[0].text)
                print(error.xpath("//Description")[0].text)
                print("")
                print(error.xpath("//Pattern")[0].text)

        if err:
            write_oioubl_xml(xml_content)
        self.assertFalse(err, "There is some error detected by the schematron")

    @freeze_time('2017-01-01')
    def test_export_credit_note_one_line_schematron_partner_dk(self):
        credit_note = self.env["account.move"].create({
            'move_type': 'out_refund',
            'partner_id': self.partner_a.id,
            'partner_bank_id': self.env.company.partner_id.bank_ids[:1].id,
            'invoice_payment_term_id': self.pay_terms_b.id,
            'invoice_date': '2017-01-01',
            'date': '2017-01-01',
            'narration': 'test narration',
            'ref': 'ref_move',
            'invoice_line_ids': [
                Command.create({
                    'product_id': self.product_a.id,
                    'quantity': 1.0,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(self.env["account.chart.template"].ref('tax120').ids)],
                }),
            ],
        })
        credit_note.action_post()
        credit_note._generate_pdf_and_send_invoice(self.move_template)
        self.assertTrue(credit_note.ubl_cii_xml_id)
        xml_content = base64.b64decode(credit_note.ubl_cii_xml_id.with_context(bin_size=False).datas)
        xml_etree = self.get_xml_tree_from_string(xml_content)

        with file_open("l10n_account_edi_ubl_cii_tests/tests/OIOUBL_CreditNote_Schematron.xsl", "rb") as schematron_file:
            xsl = etree.parse(schematron_file)
            transform = etree.XSLT(xsl)
            result_tree = transform(xml_etree)

            errors = result_tree.xpath("//Error")
            err = False
            for error in errors:
                err = True
                print("")
                print("")
                print(error.xpath("//Xpath")[0].text)
                print(error.xpath("//Description")[0].text)
                print("")
                print(error.xpath("//Pattern")[0].text)
        if err:
            write_oioubl_xml(xml_content)
        self.assertFalse(err, "There is some error detected by the schematron")

    @freeze_time('2017-01-01')
    def test_export_credit_note_two_line_schematron_partner_dk(self):
        invoice = self.env["account.move"].create({
            'move_type': 'out_refund',
            'partner_id': self.partner_a.id,
            'partner_bank_id': self.env.company.partner_id.bank_ids[:1].id,
            'invoice_payment_term_id': self.pay_terms_b.id,
            'invoice_date': '2017-01-01',
            'date': '2017-01-01',
            'narration': 'test narration',
            'ref': 'ref_move',
            'invoice_line_ids': [
                Command.create({
                    'product_id': self.product_a.id,
                    'quantity': 1.0,
                    'price_unit': 500.0,
                    'tax_ids': [Command.set(self.env["account.chart.template"].ref('tax120').ids)],
                }),
                Command.create({
                    'product_id': self.product_b.id,
                    'quantity': 1.0,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(self.env["account.chart.template"].ref('tax110').ids)],
                }),
            ],
        })
        invoice.action_post()
        invoice._generate_pdf_and_send_invoice(self.move_template)
        self.assertTrue(invoice.ubl_cii_xml_id)
        xml_content = base64.b64decode(invoice.ubl_cii_xml_id.with_context(bin_size=False).datas)
        xml_etree = self.get_xml_tree_from_string(xml_content)

        with file_open("l10n_account_edi_ubl_cii_tests/tests/OIOUBL_CreditNote_Schematron.xsl", "rb") as schematron_file:
            xsl = etree.parse(schematron_file)
            transform = etree.XSLT(xsl)
            result_tree = transform(xml_etree)

            errors = result_tree.xpath("//Error")
            err = False
            for error in errors:
                err = True
                print("")
                print("")
                print(error.xpath("//Xpath")[0].text)
                print(error.xpath("//Description")[0].text)
                print("")
                print(error.xpath("//Pattern")[0].text)
        if err:
            write_oioubl_xml(xml_content)
        self.assertFalse(err, "There is some error detected by the schematron")

    @freeze_time('2017-01-01')
    def test_export_credit_note_two_line_schematron_partner_fr(self):
        invoice = self.env["account.move"].create({
            'move_type': 'out_refund',
            'partner_id': self.partner_c.id,
            'partner_bank_id': self.env.company.partner_id.bank_ids[:1].id,
            'invoice_payment_term_id': self.pay_terms_b.id,
            'invoice_date': '2017-01-01',
            'date': '2017-01-01',
            'narration': 'test narration',
            'ref': 'ref_move',
            'invoice_line_ids': [
                Command.create({
                    'product_id': self.product_a.id,
                    'quantity': 1.0,
                    'price_unit': 500.0,
                    'tax_ids': [Command.set(self.env["account.chart.template"].ref('tax120').ids)],
                }),
                Command.create({
                    'product_id': self.product_b.id,
                    'quantity': 1.0,
                    'price_unit': 1000.0,
                    'tax_ids': [Command.set(self.env["account.chart.template"].ref('tax110').ids)],
                }),
            ],
        })
        invoice.action_post()
        invoice._generate_pdf_and_send_invoice(self.move_template)
        self.assertTrue(invoice.ubl_cii_xml_id)
        xml_content = base64.b64decode(invoice.ubl_cii_xml_id.with_context(bin_size=False).datas)
        xml_etree = self.get_xml_tree_from_string(xml_content)

        with file_open("l10n_account_edi_ubl_cii_tests/tests/OIOUBL_CreditNote_Schematron.xsl", "rb") as schematron_file:
            xsl = etree.parse(schematron_file)
            transform = etree.XSLT(xsl)
            result_tree = transform(xml_etree)

            errors = result_tree.xpath("//Error")
            err = False
            for error in errors:
                err = True
                print("")
                print("")
                print(error.xpath("//Xpath")[0].text)
                print(error.xpath("//Description")[0].text)
                print("")
                print(error.xpath("//Pattern")[0].text)
        if err:
            write_oioubl_xml(xml_content)
        self.assertFalse(err, "There is some error detected by the schematron")
