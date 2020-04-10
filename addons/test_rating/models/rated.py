# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Rated(models.Model):
    _description = 'Rated Model'
    _name = 'rated'
    _inherit = ['rating.mixin']

    name = fields.Char()

class MailRated(models.Model):
    _description = 'Mail Rated Model'
    _name = 'mail.rated'
    _inherit = ['rating.mixin', 'mail.thread']

    name = fields.Char()
