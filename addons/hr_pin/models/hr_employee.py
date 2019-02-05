# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from random import choice
from string import digits

from odoo import fields, models, api, _
from odoo.exceptions import ValidationError



class Employee(models.Model):
    _inherit = 'hr.employee'

    barcode = fields.Char(string="Badge ID", help="ID used for employee identification.", copy=False)
    pin = fields.Char(string="PIN", help="PIN used to Check In/Out in Kiosk Mode (if enabled in Configuration).", copy=False)

    _sql_constraints = [
        ('barcode_uniq', 'unique (barcode)', "The Badge ID must be unique, this one is already assigned to another employee."),
    ]


    @api.constrains('pin')
    def _verify_pin(self):
        for employee in self:
            if employee.pin and not employee.pin.isdigit():
                raise ValidationError(_("The PIN must be a sequence of digits."))

    @api.multi
    def generate_random_barcode(self):
        for i in self: i.barcode = "".join(choice(digits) for i in range(8))
