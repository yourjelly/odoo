# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _


class Partner(models.Model):
    _inherit = 'res.partner'

    type = fields.Selection(selection_add=[('subcontractor', 'Subcontractor')])

    def _get_name(self):
        name = super(Partner, self)._get_name()
        if self.type == 'subcontractor':
            contact_name = name.split(',')[-1]
            if not contact_name.strip():
                name += _('Subcontractor')
        return name
