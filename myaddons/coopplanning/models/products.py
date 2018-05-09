# -*- coding: utf-8 -*-
from odoo import models, fields, api

class Product(models.Model):
    _name = "coopplanning.product"
    name = fields.Char(required=True)
    description = fields.Text()
    price = fields.Float(digits=(6,2), default=0)