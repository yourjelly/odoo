# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import pkcs11
import platform
import base64
import jinja2
import json
import requests
import os
import sys
from pkcs11 import Attribute, ObjectClass
from asn1crypto import cms, util, x509
from pkcs11.exceptions import NoSuchToken, PinIncorrect, MultipleTokensReturned

from odoo import http, _


if hasattr(sys, 'frozen'):
    # When running on compiled windows binary, we don't have access to package loader.
    path = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', 'views'))
    loader = jinja2.FileSystemLoader(path)
else:
    loader = jinja2.PackageLoader('odoo.addons.hw_l10n_eg_eta', "views")

jinja_env = jinja2.Environment(loader=loader, autoescape=True)
jinja_env.filters["json"] = json.dumps

login_template = jinja_env.get_template('login.html')
success_template = jinja_env.get_template('success.html')
error_template = jinja_env.get_template('error.html')


class EtaUsbController(http.Controller):

    @http.route('/hw_drivers/sign/login', type='http', auth='none', cors='*', csrf=False, save_session=False)
    def eta_sign_login(self, url, otp, invoice_ids):
        return login_template.render({
            'url': url,
            'otp': otp,
            'invoice_ids': invoice_ids
        })

    @http.route('/hw_drivers/sign', type='http', auth='none', cors='*', csrf=False, save_session=False)
    def eta_sign(self, url, otp, invoice_ids, provider, pin):
        try:
            payload = {'token': otp, 'invoice_ids': invoice_ids}
            invoices = requests.get(url + '/l10n_eg_invoice/get_invoice', params=payload)

            invoices = invoices.json()
            if invoices.get('errors'):
                return self.get_error_template(invoices.get('errors'))

            invoice_dict = dict()

            lib = pkcs11.lib(self.get_crypto_lib())
            try:
                token = lib.get_token(token_label=provider)
            except NoSuchToken:
                return self.get_error_template('No drive found', 'Make sure the thumb drive is correctly inserted')
            except MultipleTokensReturned:
                return self.get_error_template('Multiple drive detected', 'Only one secure thumb drive by manufacturer can be inserted at the same time')
            except PinIncorrect:
                return self.get_error_template('Incorrect pin')

            with token.open(user_pin=pin) as session:
                cert = next(session.get_objects({Attribute.CLASS: ObjectClass.CERTIFICATE}))
                priv_key = next(session.get_objects({Attribute.CLASS: ObjectClass.PRIVATE_KEY, Attribute.ID: cert[Attribute.ID]}))
                cert = x509.Certificate.load(cert[Attribute.VALUE])

                for invoice, eta_inv in invoices.items():
                    signature = self._generate_cades_bes_signature(cert, eta_inv, priv_key)
                    invoice_dict[invoice] = {
                        'l10n_eg_signature_type': "I",
                        'l10n_eg_signature_data': signature
                    }

            payload = {
                'token': otp,
                'invoices': invoice_dict,
            }
            resp = requests.get(url + '/l10n_eg_invoice/submit_signed_invoices', params=payload)
            resp = resp.json()
            if resp.get('errors'):
                return self.get_error_template(resp.get('errors'))
        except Exception as ex:
            return self.get_error_template(str(ex))

        return success_template.render({
            'success_msg': 'Signature done !\n Please close this window',
        })

    def get_error_template(self, title, error=''):
        return error_template.render({
            'error_title': title,
            'error_msg': error,
        })

    def get_crypto_lib(self):
        system = platform.system()
        if system == 'Linux':
            return "/usr/lib/x86_64-linux-gnu/opensc-pkcs11.so"
        elif system == 'Windows':
            return "C:/Windows/System32/eps2003csp11.dll"
        elif system == 'Darwin':
            return '/Library/OpenSC/lib/onepin-opensc-pkcs11.so'
        else:
            raise Exception('System not supported')

    def _generate_cades_bes_signature(self, cert, eta_inv, priv_key):
        # specs https://sdk.invoicing.eta.gov.eg/signature-creation/
        data = json.dumps(eta_inv, indent=4)

        sd = cms.SignedData()
        # Populating some of its fields
        sd['version'] = 'v1'
        sd['encap_content_info'] = util.OrderedDict([
            ('content_type', 'data'),
            ('content', data)])
        sd['digest_algorithms'] = [util.OrderedDict([
            ('algorithm', 'sha256'),
            ('parameters', None)])]
        # Adding this certificate to SignedData object
        sd['certificates'] = [cert]
        # Setting signer info section
        signer_info = cms.SignerInfo()
        signer_info['version'] = 'v1'
        signer_info['digest_algorithm'] = util.OrderedDict([
            ('algorithm', 'sha256'),
            ('parameters', None)])
        signer_info['signature_algorithm'] = util.OrderedDict([
            ('algorithm', 'sha256_rsa'),
            ('parameters', None)])
        # Creating a signature using a private key object from pkcs11
        signer_info['signature'] = priv_key.sign(data, mechanism=pkcs11.mechanisms.Mechanism.SHA256_RSA_PKCS)
        # Finding subject_key_identifier from certificate (asn1crypto.x509 object)
        key_id = cert.key_identifier_value.native
        signer_info['sid'] = cms.SignerIdentifier({
            'subject_key_identifier': key_id})
        # Adding SignerInfo object to SignedData object
        sd['signer_infos'] = [signer_info]
        # Writing everything into ASN.1 object
        asn1obj = cms.ContentInfo()
        asn1obj['content_type'] = 'signed_data'
        asn1obj['content'] = sd
        return base64.b64encode(asn1obj.dump())
