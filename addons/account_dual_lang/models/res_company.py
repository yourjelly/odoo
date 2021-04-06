# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields, api


class ResCompany(models.Model):
    _inherit = 'res.company'

    base_lang = fields.Char('Base Language')
    dual_lang = fields.Char('Second Language')