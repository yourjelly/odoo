# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class Snippet(models.Model):
    _inherit = 'snippet'

    used_for = fields.Selection(selection_add=[
        ('mass_mailing', 'Mass Mailing Editor')
    ])
