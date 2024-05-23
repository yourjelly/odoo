# -*- coding: utf-8 -*-

from odoo import api, fields, models


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    service_tracking = fields.Selection([
        ('none', 'None'),
        ('event', 'Event')
    ], string='Service Tracking', default='none')

    @api.onchange('detailed_type')
    def _onchange_detailed_type(self):
        if self.detailed_type != 'service':
            self.service_tracking = 'none'

    @api.onchange('detailed_type', 'service_tracking')
    def _onchange_type_event(self):
        if self.detailed_type == 'service' and self.service_tracking == 'event':
            self.invoice_policy = 'order'


class Product(models.Model):
    _inherit = 'product.product'

    event_ticket_ids = fields.One2many('event.event.ticket', 'product_id', string='Event Tickets')
