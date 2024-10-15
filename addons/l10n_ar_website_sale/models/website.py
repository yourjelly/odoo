# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.addons import website_sale


class Website(website_sale.Website):

    def _display_partner_b2b_fields(self):
        """ Argentinean localization must always display b2b fields """
        self.ensure_one()
        return self.company_id.country_id.code == "AR" or super()._display_partner_b2b_fields()
