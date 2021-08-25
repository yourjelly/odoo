# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class MrpWorkorder(models.Model):
    _inherit = 'mrp.workorder'

    employee_id = fields.Many2one('hr.employee', string='Employee')
