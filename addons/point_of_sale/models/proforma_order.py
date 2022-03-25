# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import api, fields, models, tools, _
from functools import partial


class ProformaOrder(models.Model):
    _name = 'pos.proforma.order'
    _description = 'Pos Proforma order'
    _order = "date_order desc, name desc, id desc"

    name = fields.Char(string='Order Ref', required=True, readonly=True, copy=False, default='/')
    date_order = fields.Datetime(string='Date', readonly=True, index=True, default=fields.Datetime.now)
    user_id = fields.Many2one(
        comodel_name='res.users', string='Responsible',
        help="Person who uses the cash register. It can be a reliever, a student or an interim employee.",
        default=lambda self: self.env.uid,
        states={'done': [('readonly', True)], 'invoiced': [('readonly', True)]},
    )
    amount_tax = fields.Float(string='Taxes', digits=0, readonly=True, required=True)
    amount_total = fields.Float(string='Total', digits=0, readonly=True, required=True)
    amount_paid = fields.Float(string='Paid', states={'draft': [('readonly', False)]},
                               readonly=True, digits=0, required=True)
    partner_id = fields.Many2one('res.partner', string='Customer', change_default=True, index='btree_not_null',
                                 states={'draft': [('readonly', False)], 'paid': [('readonly', False)]})
    sequence_number = fields.Integer(string='Sequence Number', help='A session-unique sequence number for the order',
                                     default=1)
    session_id = fields.Many2one(
        'pos.session', string='Session', required=True, index=True,
        domain="[('state', '=', 'opened')]", states={'draft': [('readonly', False)]},
        readonly=True)
    config_id = fields.Many2one('pos.config', related='session_id.config_id', string="Point of Sale", readonly=False)
    currency_id = fields.Many2one('res.currency', related='config_id.currency_id', string="Currency")
    lines = fields.One2many('pos.order.line', 'order_id', string='Order Lines', states={'draft': [('readonly', False)]},
                            readonly=True, copy=True)
    company_id = fields.Many2one('res.company', string='Company', required=True, readonly=True)
    amount_return = fields.Float(string='Returned', digits=0, required=True, readonly=True)
    note = fields.Text(string='Internal Notes')
    currency_rate = fields.Float("Currency Rate", compute='_compute_currency_rate', compute_sudo=True, store=True, digits=0, readonly=True,
        help='The rate of the currency to the currency of rate applicable at the date of the order')

    @api.depends('date_order', 'company_id', 'currency_id', 'company_id.currency_id')
    def _compute_currency_rate(self):
        for order in self:
            order.currency_rate = self.env['res.currency']._get_conversion_rate(order.company_id.currency_id,
                                                                                order.currency_id, order.company_id,
                                                                                order.date_order)
    pricelist_id = fields.Many2one('product.pricelist', string='Pricelist', required=True, states={
        'draft': [('readonly', False)]}, readonly=True)
    pos_reference = fields.Char(string='Receipt Number', readonly=True, copy=False)

    @api.model
    def _order_fields(self, ui_order):
        process_line = partial(self.env['pos.order.line']._order_line_fields, session_id=ui_order['pos_session_id'])
        return {
            'user_id':      ui_order['user_id'] or False,
            'session_id':   ui_order['pos_session_id'],
            'lines':        [process_line(l) for l in ui_order['lines']] if ui_order['lines'] else False,
            'pos_reference': ui_order['name'],
            'sequence_number': ui_order['sequence_number'],
            'partner_id':   ui_order['partner_id'] or False,
            'date_order':   ui_order['creation_date'].replace('T', ' ')[:19],
            'pricelist_id': ui_order['pricelist_id'],
            'amount_paid':  ui_order['amount_paid'],
            'amount_total':  ui_order['amount_total'],
            'amount_tax':  ui_order['amount_tax'],
            'amount_return':  ui_order['amount_return'],
            'company_id': self.env['pos.session'].browse(ui_order['pos_session_id']).company_id.id,
        }

    @api.model
    def create_from_ui(self, orders, draft=False):
        # Do not allow any inherited model to not override this method
        raise