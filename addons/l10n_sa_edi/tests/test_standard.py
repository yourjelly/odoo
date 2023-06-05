# Part of Odoo. See LICENSE file for full copyright and licensing details.
from datetime import datetime
from freezegun import freeze_time
import logging
import os
from pytz import timezone

from odoo import Command, fields

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
                <xpath expr="//*[local-name()='IssueDate']" position="replace">
                    <IssueDate>___ignore___</IssueDate>
                </xpath>
                '''

            standard_invoice = misc.file_open('l10n_sa_edi/tests/compliance/standard/invoice.xml').read()
            expected_tree = self.get_xml_tree_from_string(standard_invoice.encode())
            expected_tree = self.with_applied_xpath(expected_tree, applied_xpath)
            move = self._create_invoice()
            move.l10n_sa_uuid = "blablabla"
            move.l10n_sa_confirmation_datetime = fields.Datetime.now()
            generated_file, dummy = self.env['account.edi.xml.ubl_21.zatca']._export_invoice(move)
            current_tree = self.get_xml_tree_from_string(generated_file)

            self.assertXmlTreeEqual(current_tree, expected_tree)
