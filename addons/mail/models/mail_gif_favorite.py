# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

class GifFavorite(models.Model):
    _name = 'mail.gif.favorite'
    _description = 'Save favorite gif from tenor API'

    tenor_gif_id = fields.Char('Gif id from tenor', required=True, index=True)

    _sql_constraints = [
        ('user_gif_favorite', 'unique(create_uid,tenor_gif_id)', 'User should not have duplicated favorite gif'),
    ]
