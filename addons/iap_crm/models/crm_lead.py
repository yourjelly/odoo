# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models
from odoo.addons import crm


class CrmLead(crm.CrmLead):

    reveal_id = fields.Char(string='Reveal ID') # Technical ID of reveal request done by IAP

    def _merge_get_fields(self):
        return super()._merge_get_fields() + ['reveal_id']
