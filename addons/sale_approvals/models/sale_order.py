# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, _
from odoo.exceptions import UserError

class SaleOrder(models.Model):
    _name = "sale.order"
    _inherit = "sale.order"

    approval_category_id = fields.Many2one('approval.category', string="Approval Category")
    approval_request_id = fields.Many2one('approval.request', string="Approval Request", readonly=True)
    approval_sent = fields.Boolean()

    def button_confirm_with_approval_request_sales(self):
        self.approval_sent = True
        for order in self:
            if order.state not in ['draft', 'sent']:
                continue

            if not order.approval_category_id:
                raise UserError('Please select an approval category before confirming the order.')

            approval_request_vals = {
                'name': f"Approval Request for {order.name}",
                'category_id': order.approval_category_id.id,
                'request_owner_id': self.env.user.id,
                'sale_order_id': self.id,
            }

            approval_request = self.env['approval.request'].create(approval_request_vals)
            approval_request.sudo().action_confirm()
            order.write({'approval_request_id': approval_request.id})

        return True

    def write(self, vals):
        res = super().write(vals)
        if 'state' in vals and vals['state'] == 'sale':
            user_id = self.create_uid.id
            self.activity_schedule(
                'mail.mail_activity_data_todo',
                user_id=user_id,
                date_deadline=fields.Date.today(),
                summary=_('Sale Order Approved'),
                note=_('Your sale order has been approved.'),
            )

            for user in self.partner_id.sale_order_approval_responsible_ids:
                if self.partner_id.check_for_users_sale:
                    self.activity_schedule(
                        'mail.mail_activity_data_todo',
                        user_id=user.id,
                        date_deadline=fields.Date.today(),
                        summary=_('Sale Order Approved'),
                        note=_('Check this sale sale order.'),
                    )

        return res

    def create(self, vals):
        record = super(SaleOrder, self).create(vals)
        if record.state == 'draft':
            for user in record.partner_id.sale_order_creation_responsible_ids:
                if record.partner_id.check_for_users_sale:
                    record.activity_schedule(
                        'mail.mail_activity_data_todo',
                        user_id=user.id,
                        date_deadline=fields.Date.today(),
                        summary=_('Sale Order Created'),
                        note=_('New sale order has been created.'),
                    )

        return record
