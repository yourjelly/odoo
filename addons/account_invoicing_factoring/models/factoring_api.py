# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.addons.iap.models import iap


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
                'city': company.city,
                'phone': company.phone,
                'email': company.email,
                'database': self._cr.dbname,
                'account_token': self._get_factoring_account().account_token,
                'username': username,
                'password': password
            }
        }
        iap.jsonrpc(self._get_endpoint() + '/factoring/validate-partner', params=params)
