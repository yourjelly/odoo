# -*- coding: utf-8 -*-

from functools import partial

from odoo import models, fields, api
from odoo.exceptions import ValidationError


class PosOrder(models.Model):
    _inherit = "pos.order"

    employee_id = fields.Many2one(
        comodel_name='hr.employee', string='Employee',
        help="Person who uses the cash register. It can be a reliever, a student or an interim employee.",
        states={'done': [('readonly', True)], 'invoiced': [
            ('readonly', True)]},
    )

    cashier = fields.Char(string="Cashier", compute="_compute_cashier")

    @api.model
    def _order_fields(self, ui_order):
        order_fields = super(PosOrder, self)._order_fields(ui_order)
        order_fields.update(
            {'employee_id':  ui_order.get('employee_id', False)})
        return order_fields

    @api.multi
    def _compute_cashier(self):
        for rec in self:
            if rec.employee_id:
                rec.cashier = rec.employee_id.name
            else:
                rec.cashier = rec.user_id.name
