# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, _
class ApprovalRequest(models.Model):
    _name = "approval.request"
    _inherit = "approval.request"

    purchase_order_id = fields.Many2one('purchase.order', readonly=True)

    def action_approve(self, approver=None):
        super(ApprovalRequest, self).action_approve(approver=approver)
        order_id = self.purchase_order_id
        if self.request_status == 'approved':
            order_id.button_confirm()

