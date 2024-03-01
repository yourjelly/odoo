# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, _
from odoo.exceptions import UserError

class PurchaseOrder(models.Model):
    _name = "purchase.order"
    _inherit = "purchase.order"

    approval_category_id = fields.Many2one('approval.category', string="Approval Category")
    approval_request_id = fields.Many2one('approval.request', string="Approval Request", readonly=True)
    approval_sent = fields.Boolean()

    def button_confirm_with_approval_request(self):
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
                'purchase_order_id': self.id,
            }

            approval_request = self.env['approval.request'].create(approval_request_vals)
            approval_request.sudo().action_confirm()
            order.write({'approval_request_id': approval_request.id})

        return True

    def write(self, vals):
        vals, partner_vals = self._write_partner_values(vals)
        res = super().write(vals)

        if 'state' in vals and vals['state'] == 'purchase':
            user_id = self.create_uid.id
            self.activity_schedule(
                'mail.mail_activity_data_todo',
                user_id=user_id,
                date_deadline=fields.Date.today(),
                summary=_('Purchase Order Approved'),
                note=_('Your purchase order has been approved.'),
            )

            for user in self.partner_id.purchase_order_approval_responsible_ids:
                if self.partner_id.check_for_users:
                    self.activity_schedule(
                        'mail.mail_activity_data_todo',
                        user_id=user.id,
                        date_deadline=fields.Date.today(),
                        summary=_('Purchase Order Approved'),
                        note=_('Check this approved purchase order.'),
                    )

        return res

    def create(self, vals):
        record = super(PurchaseOrder, self).create(vals)
        if record.state == 'draft':
            for user in record.partner_id.purchase_order_creation_responsible_ids:
                if record.partner_id.check_for_users:
                    record.activity_schedule(
                        'mail.mail_activity_data_todo',
                        user_id=user.id,
                        date_deadline=fields.Date.today(),
                        summary=_('Purchase Order Created'),
                        note=_('New puchase order has been created.'),
                    )

        return record

    