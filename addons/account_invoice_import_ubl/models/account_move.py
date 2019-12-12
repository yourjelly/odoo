# -*- coding: utf-8 -*-

from odoo import api, models, fields, tools, _
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT, float_repr
from odoo.tests.common import Form
from odoo.exceptions import UserError

from datetime import datetime

import logging

_logger = logging.getLogger(__name__)


class AccountMove(models.Model):
    _inherit = 'account.move'

    def _export_invoice_with_ubl(self):
        ''' Create the content of the xml UBL file for the current invoice. '''
        self.ensure_one()

        def format_monetary(amount):
            # Format the monetary values to avoid trailing decimals (e.g. 90.85000000000001).
            return float_repr(amount, self.currency_id.decimal_places)

        def get_line_values(line):
            return {
                'note': _('Discount (%s %)') % line.discount if line.discount else None,
                'taxes': line.tax_ids.compute_all(
                    line.price_unit,
                    quantity=line.quantity,
                    product=line.product_id,
                    partner=self.partner_id)['taxes'],
            }

        # Create file content.
        content = self.env.ref('account_invoice_import_ubl.export_ubl_invoice').render({
            'invoice': self,

            'ubl_version': 2.1,
            'type_code': 380 if self.type == 'out_invoice' else 381,
            'payment_means_code': 42 if self.journal_id.bank_account_id else 31,

            'format_monetary': format_monetary,
            'get_line_values': get_line_values,
        })
        return b"<?xml version='1.0' encoding='UTF-8'?>" + content

    @api.model
    def _import_invoice_with_ubl(self, tree):
        # TODO
        pass

    def _detect_invoice_ubl(self, tree, file_name):
        return {
            'flag': tree.tag == '{urn:oasis:names:specification:ubl:schema:xsd:Invoice-2}Invoice',
            'error': None,
        }

    @api.model
    def _get_xml_decoders(self):
        # OVERRIDE
        res = super()._get_xml_decoders()
        res.append(('UBL', self._detect_invoice_ubl, self._import_invoice_with_ubl))
        return res

    def _embed_edi_files_in_report(self):
        # OVERRIDE
        res = super()._embed_edi_files_in_report()
        filename = 'UBL-%s.xml' % (self.name or '').replace('/', '')
        res.append((filename, self._export_invoice_with_ubl()))
        return res
