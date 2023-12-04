from odoo import models, fields, api

class PosOrder(models.Model):
    _inherit = 'pos.order'

    attendee_count = fields.Integer('Attendee Count', compute='_compute_attendee_count')

    @api.depends('lines.event_registration_ids')
    def _compute_attendee_count(self):
        for order in self:
            order.attendee_count = len(order.lines.mapped('event_registration_ids'))

    def action_view_attendee_list(self):
        action = self.env["ir.actions.actions"]._for_xml_id("event.event_registration_action_tree")
        action['domain'] = [('pos_order_id', 'in', self.ids)]
        return action



class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

    event_id = fields.Many2one('event.event', string='Event', compute="_compute_event_id", store=True, precompute=True)
    event_ticket_id = fields.Many2one('event.event.ticket', string='Event Ticket')
    event_registration_ids = fields.One2many('event.registration', 'pos_order_line_id', string='Event Registrations')

    @api.depends('event_registration_ids')
    def _compute_event_id(self):
        for line in self:
            line.event_id = line.event_registration_ids.event_id

    def _export_for_ui(self, orderline):
        result = super()._export_for_ui(orderline)
        result['event_id'] = orderline.event_id.id
        result['event_ticket_id'] = orderline.event_ticket_id.id
        result['event_registration_ids'] = orderline.event_registration_ids.ids
        return result

    def _get_event_sale_total(self):
        return self.price_subtotal_incl

    def _get_event_sale_state(self):
        return self.order_id.state in ['done', 'paid', 'invoiced']
