# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, api


class StockMove(models.Model):
    _inherit = "l10n.in.ewaybill"

    @api.depends('stock_picking_id')
    def _compute_document_partners_details(self):
        super()._compute_document_partners_details()
        for ewaybill in self:
            purchase_id = ewaybill.stock_picking_id.purchase_id
            if purchase_id:
                ewaybill.partner_bill_to_id = purchase_id.company_id.partner_id
                ewaybill.partner_bill_from_id = purchase_id.partner_id
                ewaybill.partner_ship_to_id = purchase_id.company_id.partner_id
                ewaybill.partner_ship_from_id = purchase_id.partner_id
