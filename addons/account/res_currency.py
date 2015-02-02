# -*- coding: utf-8 -*-
##############################################################################
#
#    Copyright (C) 2010 OpenERP s.a. (<http://www.openerp.com>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################

from openerp import api, models
from openerp.exceptions import UserError

"""Inherit res.currency to handle accounting date values when converting currencies"""

class res_currency_account(models.Model):
    _inherit = "res.currency"

    @api.model
    def _get_conversion_rate(self, from_currency, to_currency):
        rate = super(res_currency_account, self)._get_conversion_rate(from_currency, to_currency)
        #process the case where the account doesn't work with an outgoing currency rate method 'at date' but 'average'
        account = self._context.get('res.currency.compute.account')
        account_invert = self._context.get('res.currency.compute.account_invert')
        if account and account.currency_mode == 'average' and account.currency_id:
            query = self.env['account.move.line']._query_get()
            self._cr.execute('select sum(debit-credit),sum(amount_currency) from account_move_line l ' \
              'where l.currency_id=%s and l.account_id=%s and '+query, (account.currency_id.id,account.id,))
            tot1,tot2 = self._cr.fetchone()
            if tot2 and not account_invert:
                rate = float(tot1)/float(tot2)
            elif tot1 and account_invert:
                rate = float(tot2)/float(tot1)
        return rate

    @api.one
    def _set_currency_company_rate(self, company_id):
        """Generates the currency rate for the company"""
        res_currency_rate = self.env['res.currency.rate']
        if self.search_count([('company_id', '=', company_id)]):
            # has already the currencies for this company
            return True

        if res_currency_rate.search_count([('company_id', '=', company_id)]):
            # has already rates for this company configured
            # TODO: should we check rate for for currency_id=self.id is 1?
            return True

        # eur = self.ref('base.EUR')

        rates = {}
        for base_rate in res_currency_rate.search([('company_id', '=', False)]):
            # base data rates basic are (amount / rate = amount EUR)
            # creates rate for each currency so that (amount / rate = amount in company's currency)
            currency = base_rate.currency_id
            if rates.get(currency,{}).get('name') > base_rate.name:
                # has already a more rescent currency
                continue

            try:
                rate = self.with_context({'date': base_rate.name}).compute(1.0, currency)
            except UserError:
                # no currency rate for this
                continue

            rates.setdefault(currency.id, {})
            rates[currency.id].update({
                'name': base_rate.name,
                'currency_id': currency.id,
                'company_id': company_id,
                'rate': rate
            })

        for rate_data in rates.values():
            res_currency_rate.create(rate_data)

        return True