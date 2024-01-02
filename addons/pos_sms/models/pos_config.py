# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    sms_receipt_template_id = fields.Many2one('sms.template', string="Receipt template", domain=[('model', '=', 'pos.order')])
