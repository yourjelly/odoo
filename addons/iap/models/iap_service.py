# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class IapService(models.Model):
    _name = 'iap.service'
    _description = 'IAP Service'

    name = fields.Char()
    technical_name = fields.Char(readonly=True)
    description = fields.Char()
    unit_name = fields.Char(default='Credits')
    integer_balance = fields.Boolean()
