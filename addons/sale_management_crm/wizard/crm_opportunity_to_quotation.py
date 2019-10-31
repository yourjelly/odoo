# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class Opportunity2Quotation(models.TransientModel):

    _inherit = 'crm.quotation.partner'

    def action_apply(self):
        """ Convert lead to opportunity or merge lead and opportunity and open
            the freshly created opportunity view.
        """
        self.ensure_one()
        if self.action != 'nothing':
            self.lead_id.write({
                'partner_id': self.partner_id.id if self.action == 'exist' else self._create_partner()
            })
            self.lead_id._onchange_partner_id()
        return self.lead_id.action_new_quotation()

