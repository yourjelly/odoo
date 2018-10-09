# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models


class JsonParse(models.Model):
    _inherit = 'mail.activity'

    startdate = fields.Date("Start Date")
