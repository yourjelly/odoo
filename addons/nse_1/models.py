# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class NSE(models.Model):
    _name = "nse.demo"

    name = fields.Char(string="Name", translate=False)