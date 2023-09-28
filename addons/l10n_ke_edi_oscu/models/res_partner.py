# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


URL = "https://etims-api-sbx.kra.go.ke/etims-api/"
SAVE_PARTNER_URL = URL + "saveBhfCustomer"
FETCH_PARTNER_URL = URL + "selectCustomer"

class ResPartner(models.Model):
    _inherit = 'res.partner'
    l10n_ke_oscu_synchronized = fields.Boolean()

    def _l10n_ke_oscu_partner_content(self):
        """Returns a dict with the commonly required fields on partner for requests to the OSCU """
        self.ensure_one()
        return {
            'custNo':  self.id,                              # Customer Number
            'custTin': self.vat,                             # Customer PIN
            'custNm':  self.name,                            # Customer Name
            'adrs':    self.contact_address_inline or None,  # Address
            'email':   self.email or None,                   # Email
            'useYn':   'Y' if self.active else 'N',          # Used (Y/N)
        }

    def action_l10n_ke_oscu_register_bhf_customer(self):
        for partner in self:
            content = {
                'regrId':  partner.env.user.id,              # Registration
                'regrNm':  partner.env.user.name,            # Registration
                'modrId':  partner.env.user.id,              # Modifier
                'modrNm':  partner.env.user.name,            # Modifier Name
                **partner._l10n_ke_oscu_partner_content()    # Partner details
            }
            session = (partner.company_id or self.env.company).l10n_ke_oscu_get_session()
            response = session.post(SAVE_PARTNER_URL, json=content)
            response_content = response.json()
            if response_content['resultCd'] == '001':
                return None
            if response_content['resultCd'] != '000':
                raise ValidationError('Request Error Code: %s, Message: %s', response_content['resultCd'], response_content['resultMsg'])
            partner.l10n_ke_oscu_synchronized = True

    def action_l10n_ke_oscu_fetch_bhf_customer(self, tin):

        company = self.company_id or self.env.company
        session = company.l10n_ke_oscu_get_session()
        response = session.post(FETCH_PARTNER_URL, json={'custmTin': tin})
        return response
