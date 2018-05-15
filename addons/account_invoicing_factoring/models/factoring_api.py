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
        return self.env['ir.config_parameter'].sudo().get_param('factoring.endpoint', DEFAULT_ENDPOINT)

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
                'country_code': company.country_id.code,
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
                    'phone': partner.phone,
                    'mobile': partner.mobile,
                    'city': partner.city,
                    'country_code': partner.country_id.code,
                    'zip_code': partner.zip,
                    'finexkap_uuid': partner.finexkap_uuid
                })
        if debtors:
            params = {
                'account_token': self._get_factoring_account().account_token,
                'debtors': debtors
            }
            result = iap.jsonrpc("%s/factoring/send-debtors" % self._get_endpoint(), params=params)
            invalid_partners = result['invalid']
            success_partners = result['success']
            for partner in partners:
                if partner.siret not in invalid_partners:
                    partner.write({
                        'finexkap_uuid': success_partners[partner.siret].get('uuid'),
                        'finexkap_status': success_partners[partner.siret].get('status')
                    })
            if invalid_partners:
                return {
                    'name': _('Debtor Response'),
                    'view_type': 'form',
                    'view_mode': 'form',
                    'res_model': 'debtor.request.response',
                    'type': 'ir.actions.act_window',
                    'target': 'new',
                    'context': {
                        'partners': list(invalid_partners.values())
                    }
                }
        return True

    def _request_invoices(self, offer):

        invoices = []
        for invoice in offer.invoice_ids:
            invoices.append({
            })

        params = {
            'account_token': self._get_factoring_account().account_token
        }
        # return iap.jsonrpc("%s/factoring/request-invoices" % self._get_endpoint(), params=params)
