# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


class PosOrder(models.Model):
    _inherit = "pos.order"

    paid_invoice_id = fields.Many2one('account.move', 'Paid Invoice')

    @api.model
    def _order_fields(self, ui_order):
        result = super()._order_fields(ui_order)
        result['paid_invoice_id'] = ui_order.get('paid_invoice_id', False)
        return result

    def action_view_paid_invoice(self):
        return {
            'name': _('Paid Invoice'),
            'view_mode': 'form',
            'view_id': self.env.ref('account.view_move_form').id,
            'res_model': 'account.move',
            'context': "{'move_type':'out_invoice'}",
            'type': 'ir.actions.act_window',
            'res_id': self.paid_invoice_id.id,
        }
