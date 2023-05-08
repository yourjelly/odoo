# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import time

import pytz
import logging
import requests
import json
import base64
import hashlib
import os
import zipfile
import io

from OpenSSL.crypto import PKey, X509
from datetime import datetime

from odoo import api, models, fields, _, _lt

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.padding import PKCS7
from odoo.tools import file_open


_logger = logging.getLogger(__name__)

DEFAULT_PL_EINVOICE_DATE_FORMAT = '%Y-%m-%d'
DEFAULT_PL_EINVOICE_DATETIME_FORMAT = '%Y-%m-%dT%H:%M:%SZ'


class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    def _l10n_pl_edi_export_invoice_as_xml(self, invoice):
        ''' Create the xml file content.
        :return: The XML content as str.
        '''
        template_values = invoice._prepare_pl_einvoice_export_values()
        content = self.env['ir.qweb']._render('l10n_pl_edi.account_invoice_pl_ksef_export', template_values)
        return content

    def _post_invoice_edi(self, invoices):
        # OVERRIDE
        self.ensure_one()
        edi_result = super()._post_invoice_edi(invoices)
        if self.code != 'ksef':
            return edi_result

        return self._post_ksef_einvoicing(invoices)

    def _get_move_applicability(self, move):
        # OVERRIDE
        self.ensure_one()
        if self.code != 'ksef':
            return super()._get_move_applicability(move)

        if move.country_code == 'PL':
            return {
                'post': self._post_ksef_einvoicing,
            }

    def _post_ksef_einvoicing(self, invoices):
        ''' Send the invoices to the proxy.
        '''
        to_return = {}
        res = json.loads(requests.post('https://ksef-test.mf.gov.pl/api/online/Session/AuthorisationChallenge', json={
            "contextIdentifier": {
                "type": "onip",
                "identifier": "9999999999"
            }
        }).text)
        utc_time = datetime.strptime(res.get('timestamp'), "%Y-%m-%dT%H:%M:%S.%fZ")
        epoch_time = (utc_time - datetime(1970, 1, 1)).total_seconds()

        token_example = "D1989FAA8B797BEC0B15EB9B634093CD61147E571AECDC206CF97B0D32A7D2D6"

        with file_open("l10n_pl_edi/data/publicKey.pem", "rb") as key_file:
            public_key = serialization.load_pem_public_key(
                key_file.read(),
            )

        message_to_encrypt = token_example + '|' + str(int(epoch_time*1000))
        encrypted_text = public_key.encrypt(bytes(message_to_encrypt, 'utf-8'), padding.PKCS1v15())
        string = base64.b64encode(encrypted_text).decode()

        template_values = {
            'challenge': res.get('challenge'),
            'nip': '9999999999',
            'token': string
        }
        string_xml = self.env['ir.qweb']._render('l10n_pl_edi.init_session_token_request_template', template_values)
        string_xml = str(string_xml)

        res = json.loads(requests.post('https://ksef-test.mf.gov.pl/api/online/Session/InitToken', data=string_xml
        ).text)


        to_send = {}
        for invoice in invoices:
            xml = "<?xml version='1.0' encoding='UTF-8'?>" + str(self._l10n_pl_edi_export_invoice_as_xml(invoice))
            filename = f"Test_invoice_{datetime.strftime(pytz.utc.localize(fields.Datetime.now()), DEFAULT_PL_EINVOICE_DATETIME_FORMAT)}.xml"
            attachment = self.env['ir.attachment'].create({
                'name': filename,
                'res_id': invoice.id,
                'res_model': invoice._name,
                'raw': xml.encode(),
                'description': _('Polish invoice: %s', invoice.move_type),
                'type': 'binary',
            })

            to_return[invoice] = {'attachment': attachment, 'success': True}


            # key = os.urandom(32)
            # iv = os.urandom(16)
            # cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
            # encryptor = cipher.encryptor()
            # encrypted_aes_key = public_key.encrypt(message_to_encrypt.encode(), padding.PKCS1v15())
            #
            # stream = io.BytesIO()
            # with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
            #     zf.writestr(filename, attachment.datas)
            # archive_file_content = stream.getvalue()
            # zip_hashed_256 = base64.b64encode(hashlib.sha256(archive_file_content).digest())
            #
            # with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
            #     zf.writestr("archive1", archive_file_content)
            # file_content = stream.getvalue()
            # child_zip_hashed_256 = base64.b64encode(hashlib.sha256(file_content).digest())
            # padder = PKCS7(32).padder()
            # padded_data = padder.update(child_zip_hashed_256)
            # padded_data += padder.finalize()
            # part_hashed_encrypted = encryptor.update(padded_data) + encryptor.finalize()

            # part_hashed_encrypted_256 = base64.b64encode(hashlib.sha256(part_hashed_encrypted).digest())

            # template_values = {
            #     'nip': '9999999999',
            #     'encrypted_aes_key': base64.b64encode(encrypted_aes_key).decode(),
            #     'iv': base64.b64encode(iv).decode(),
            #     'zip_hashed_256': zip_hashed_256.decode(),
            #     'total_zip_size': len(archive_file_content),
            #     'part_hashed_encrypted_256': part_hashed_encrypted_256.decode(),
            #     'child_zip_size': len(file_content),
            # }
            # string_xml = self.env['ir.qweb']._render('l10n_pl_edi.init_batch_request_template', template_values)




            sha256_digest = hashlib.sha256(xml.encode()).digest()
            sha_base64 = base64.b64encode(sha256_digest).decode()
            input_len = len(xml.encode())
            content_base64 = base64.b64encode(xml.encode())

            res2 = json.loads(requests.put(
                "https://ksef-test.mf.gov.pl/api/online/Invoice/Send",
                json={

                    "invoiceHash": {
                        "hashSHA": {
                            "algorithm": "SHA-256",
                            "encoding": "Base64",
                            "value": sha_base64
                        },
                        "fileSize": input_len,
                    },
                    "invoicePayload": {
                        "type": "plain",
                        "invoiceBody": content_base64.decode()
                    }
                },
                headers={'SessionToken': res.get('sessionToken').get('token')},
            ).text)

            res_invoice = requests.get(
                f"https://ksef-test.mf.gov.pl/api/online/Invoice/Status/{res2.get('elementReferenceNumber')}",
                headers={'SessionToken': res.get('sessionToken').get('token')},
                timeout=30,
            )

            print("hey")
        return to_return

