# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ServerAction(models.Model):
    _inherit = "ir.actions.server"

    def _default_sequence(self):
        menu = self.search([
            ('usage', '=', 'base_automation'),
            ('base_automation_id', '=', self.env.context.get('default_base_automation_id')),
        ], limit=1, order="sequence DESC")
        return menu.sequence + 1

    sequence = fields.Integer(default=_default_sequence)
    base_automation_id = fields.Many2one('base.automation', 'Automation', ondelete='cascade')
    usage = fields.Selection(selection_add=[
        ('base_automation', 'Automation Rule')
    ], ondelete={'base_automation': 'cascade'})
