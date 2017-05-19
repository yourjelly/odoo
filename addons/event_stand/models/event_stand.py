# -*- coding: utf-8 -*-

from odoo import models, fields, api
from odoo.addons import decimal_precision as dp

class event_event(models.Model):
    _inherit = 'event.event'

    website_exhibitors = fields.Boolean('Has Exhibitors')
    slot_count         = fields.Integer('Slots', compute="_slot_count")
    slot_sold_count  = fields.Integer('Sold Slots', compute="_slot_count")
    stand_count        = fields.Integer('Stands', compute="_stand_count")
    stand_sold_count = fields.Integer('Sold Stands', compute="_stand_count")
    exhibition_map     = fields.Binary('Exhibition Map')

    def _stand_count(self, key='stand'):
        obj = (key=='stand') and 'event_stand.stand' or 'event_stand.stand.slot'
        event_data = self.env[obj].read_group([('event_id', 'in', self.ids)], ['event_id', 'state'], ['event_id', 'state'], lazy=False)
        mapped_data = {}
        for record in event_data:
            mapped_data.setdefault(record['event_id'][0], {'all': 0, 'sold': 0})
            if record['state'] in ('sold', 'available'):
                mapped_data[record['event_id'][0]]['all'] += record['__count']
            if record['state'] == 'sold':
                mapped_data[record['event_id'][0]]['sold'] += record['__count']
        for record in self:
            setattr(record, key+'_count', mapped_data.get(record.id, {}).get('all', 0))
            setattr(record, key+'_sold_count', mapped_data.get(record.id, {}).get('sold', 0))

    def _slot_count(self):
        return self._stand_count(key='slot')

class event_stand_type(models.Model):
    _name = 'event_stand.stand.type'
    _order = "sequence"

    name         = fields.Char('Stand Type', required=True)
    sequence     = fields.Integer('Sequence')
    photo        = fields.Binary('Stand Photo')
    description  = fields.Html('Description')
    event_id     = fields.Many2one('event.event', string='Event', required=True)
    product_id   = fields.Many2one('product.product', 'Product')
    main         = fields.Boolean('Default Option')
    price        = fields.Float('Price', digits=dp.get_precision('Product Price'))
    price_upsell = fields.Float('Upsell Price', digits=dp.get_precision('Product Price'))
    slot_all     = fields.Boolean('Get All Slots')

    company_id   = fields.Many2one('res.company', string='Company', index=True, default=lambda self: self.env.user.company_id.id)
    currency_id  = fields.Many2one(string='Currency', related='company_id.currency_id', readonly=True, relation="res.currency")


class event_stand(models.Model):
    _name = 'event_stand.stand'
    _order = "name"

    name = fields.Char('Stand Ref', required=True)
    type_id = fields.Many2one('event_stand.stand.type', string='Stand Type', required=True)
    state = fields.Selection([('available','Available'),('sold','Sold'),('unavailable','Unavailable')],
        string='State', required=True, default='available')
    slot_ids = fields.One2many('event_stand.stand.slot', 'stand_id', string="Slots")
    event_id   = fields.Many2one(string='Event', related='type_id.event_id', relation="event.event", store=True)

    # Fields to fill only when the Stand is sold
    partner_id = fields.Many2one('res.partner', "Exhibitor")


class event_stand_slot(models.Model):
    _name = 'event_stand.stand.slot'
    _order = "stand_id, name"

    name       = fields.Char('Track', required=True)
    stand_id   = fields.Many2one('event_stand.stand', string='Stand', required=True)
    event_id   = fields.Many2one(string='Event', related='stand_id.event_id', readonly=True, relation="event.event", store=True)

    subject      = fields.Char('Topic')
    partner_name = fields.Char('Topic')
    so_line_id = fields.Many2one('sale.order.line', 'Sale Order Line')
    state      = fields.Selection([('available','Available'),('sold','Sold'),('unavailable','Unavailable')],
        string='State', required=True, default='available')

class sale_order_line(models.Model):
    _inherit = "sale.order.line"
    # If these fields are set, it's a sale.order related to an exhibitor event
    stand_id = fields.Many2one('event_stand.stand', string='Stand')
    slot_ids  = fields.Many2many('event_stand.stand.slot', 'sale_line_id', 'slot_id', string="Slot")

class sale_order(models.Model):
    _inherit = "sale.order"

    # todo: if stand_id is set on a sale orde line:
    #    - Set stand and Slot_id to "Sold" state
    #
    def action_confirm(self):
        result = super(sale_order, self).action_confirm()
        for line in self.order_line:
            if line.stand_id and line.slot_ids:
                for slot in line.slot_ids:
                    slot.state = 'sold'
                    slot.partner_name = self.partner_id.name
                    slot.so_line_id = line.id

                # if all slots are sold or unavailable (and min 1 sold), stand is sold
                sold = None
                for slot in line.stand_id.slot_ids:
                    if slot.state == 'available':
                        line.stand_id.state = 'available'
                        sold = False
                        break
                    if (slot is None) and slot.state=='sold':
                        sold = True
                if sold is True:
                    line.stand_id.state = 'sold'
        return result



