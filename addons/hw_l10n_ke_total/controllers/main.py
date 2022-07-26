# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64
import logging
import platform
import json

#from FP import FP, Enums

from odoo import http
from odoo.tools.config import config

_logger = logging.getLogger(__name__)


class TotalUsbController(http.Controller):

    def _is_access_token_valid(self, access_token):
        stored_hash = config.get('proxy_access_token')
        if not stored_hash:
            # empty password/hash => authentication forbidden
            return False
        return crypt_context.verify(access_token, stored_hash)

    @http.route('/hw_l10n_ke_total/send', type='http', auth='none', cors='*', csrf=False, save_session=False, methods=['POST'])
    def tims_send(self, invoices): #TODO: pin, access_token later (be careful because pin means vat number
        """
        Check if the access_token is valid and sign the invoices accessing the usb key with the pin.
        @param pin: pin of the token
        @param access_token: token shared with the main odoo instance
        @param invoices: dictionary of invoices. Keys are invoices ids, value are the base64 encoded binaries to sign
        """
        #if not self._is_access_token_valid(access_token):
        #    return self._get_error_template('unauthorized')

        response_dict = {'invoices': {}}
        invoices_dict = json.loads(invoices)
        # Make connection

        for invoice, tims_json in invoices_dict.items():
            from .FP import FP, Enums
            fp = FP()
            fp.serverSetSettings("localhost", 4444) # TODO: use the passed url
            tcp = ""
            password = ""
            port = ""
            fp.serverSetDeviceTcpSettings(tcp, password, port)
            #import pdb; pdb.set_trace()
            fp.OpenInvoiceWithFreeCustomerData(tims_json['company_name'][:30],
                                               tims_json['buyer_pin'][:14],
                                               tims_json['partner_name'][:30],
                                               tims_json['partner_addr'][:30],
                                               tims_json['partner_zip'][:30],
                                               '0', "000000124") #tims_json['invoice_name'].replace("/", "")
            #print(fp.ReadStatus())
            #fp.OpenReceipt(Enums.OptionReceiptFormat.Brief, "POS99") #tims_json['invoice_name'].strip("/")

            for invoice_line in tims_json.get('invoice_lines', []):
                fp.SellPLUfromExtDB(invoice_line['name'].strip("[]/"), invoice_line['vat_class'],
                                    invoice_line['price'], invoice_line['uom'],
                                    '', '', '0', invoice_line['quantity'],
                                    invoice_line['discount'])
            #print(fp.ReadCurrentReceiptInfo())
            result = fp.CloseReceipt()

            response_dict['invoices'] = json.dumps({invoice: {'qrcode': result.QRcode,
                                                              'cuserial': result.InvoiceNum}})
        return json.dumps(response_dict)

    def _get_error_template(self, error_str):
        return json.dumps({
            'error': error_str,
        })
