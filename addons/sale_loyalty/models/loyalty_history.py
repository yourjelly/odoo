# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class LoyaltyHistory(models.Model):
    _inherit = "loyalty.history"

    order_id = fields.Reference(selection_add=[('sale.order', 'Sale Order')])

    def _get_order_portal_url(self):
        if self.order_id and self.order_id._name == 'sale.order':
            return self.order_id.get_portal_url()
        return super()._get_order_portal_url()
