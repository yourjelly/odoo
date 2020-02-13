# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    hr_presence_last_compute_date = fields.Datetime()
    hr_presence_control_email_amount = fields.Integer(string="# emails to send", default=1)
    hr_presence_control_ip_list = fields.Char(string="Valid IP addresses")
