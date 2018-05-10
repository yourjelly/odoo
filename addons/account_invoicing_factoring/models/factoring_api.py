# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models, _
from odoo.addons.iap.models import iap
from odoo.exceptions import UserError


DEFAULT_ENDPOINT = 'http://localhost:8090'


class FactoringAPI(models.AbstractModel):
    _name = 'factoring.api'

    @api.model
    def _get_endpoint(self):
        return self.env['ir.config_parameter'].sudo().get_param('factoring.endpoing', DEFAULT_ENDPOINT)

    @api.model
    def _get_factoring_account(self):
        return self.env['iap.account'].get('factoring')

    @api.model
    def _update_credentials(self, company, username, password):
        params = {
            'partner': {
                'name': company.name,
                'url': self.env['ir.config_parameter'].sudo().get_param('web.base.url'),
                'siret': company.siret,
                'country_code': company.country_id.code.lower(),
                'currency_code': company.currency_id.name,
                'city': company.city,
                'phone': company.phone,
                'email': company.email,
                'database': self._cr.dbname,
                'account_token': self._get_factoring_account().account_token,
                'username': username,
                'password': password
            }
        }
        status = iap.jsonrpc('%s/factoring/validate-partner' % self._get_endpoint(), params=params)
        company.write({'finexkap_account_status': status})

    def _send_debtors(self, partners):
        debtors = []
        for partner in partners:
            if partner.siret:
                debtors.append({
                    'name': partner.name,
                    'siret': partner.siret,
                    'address': partner.street,
                    'street': partner.street2,
                    'city': partner.city,
                    'country_code': partner.country_id.code.lower(),
                    'zip_code': partner.zip,
                    'finexkap_uuid': partner.finexkap_uuid
                })
        if debtors:
            params = {
                'account_token': self._get_factoring_account().account_token,
                'debtors': debtors
            }
            result = iap.jsonrpc("%s/factoring/send-debtors" % self._get_endpoint(), params=params)
            for partner in partners:
                partner.write({
                    'finexkap_uuid': result[partner.siret].get('uuid'),
                    'finexkap_status': result[partner.siret].get('status')
                })

    def _request_invoices(self, offer):

        invoices = []
        for invoice in offer.invoice_ids:
            invoices.append({
                
            })

        params = {
            'account_token': self._get_factoring_account().account_token
        }
        print(">>>>>>>", params)
        # return iap.jsonrpc("%s/factoring/request-invoices" % self._get_endpoint(), params=params)
