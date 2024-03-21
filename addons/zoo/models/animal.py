# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Animal(models.Model):
    _name = 'zoo.animal'
    _description = 'Animal'

    name = fields.Char(required=True)
