# -*- coding: utf-8 -*-

from odoo import models

import base64
from odoo.addons.account_edi_ubl.models import xml_builder

class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    ####################################################
    # Export
    ####################################################

    @xml_builder.builder('efff_1')
    def _get_xml_builder(self, invoice, parent_builder):
        # parent_builder is ubl_2_1 (should be ubl_2_0 but for the sake of the example I changed it in the data)
        print('Stuff specific to e-fff')
        return parent_builder

    def _export_efff(self, invoice):
        self.ensure_one()
        # Create file content.
        #builder = self.env['account.edi.format']._get_ubl_2_0_builder(invoice)
        builder = self._get_xml_builder(invoice)
        xml_content = builder.build()
        xml_name = '%s.xml' % invoice._get_efff_name()
        return self.env['ir.attachment'].create({
            'name': xml_name,
            'datas': base64.encodebytes(xml_content),
            'mimetype': 'application/xml',
        })

    ####################################################
    # Account.edi.format override
    ####################################################

    def _create_invoice_from_xml_tree(self, filename, tree):
        self.ensure_one()
        if self.code == 'efff_1' and self._is_ubl(filename, tree):
            return self._create_invoice_from_ubl(tree)
        return super()._create_invoice_from_xml_tree(filename, tree)

    def _update_invoice_from_xml_tree(self, filename, tree, invoice):
        self.ensure_one()
        if self.code == 'efff_1' and self._is_ubl(filename, tree):
            return self._update_invoice_from_ubl(tree, invoice)
        return super()._update_invoice_from_xml_tree(filename, tree, invoice)

    def _is_compatible_with_journal(self, journal):
        self.ensure_one()
        if self.code != 'efff_1':
            return super()._is_compatible_with_journal(journal)
        return journal.type == 'sale' and journal.country_code == 'BE'

    def _post_invoice_edi(self, invoices):
        self.ensure_one()
        if self.code != 'efff_1':
            return super()._post_invoice_edi(invoices)
        res = {}
        for invoice in invoices:
            attachment = self._export_efff(invoice)
            res[invoice] = {'attachment': attachment}
        return res
