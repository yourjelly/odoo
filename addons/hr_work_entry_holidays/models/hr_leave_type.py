# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class HrLeaveType(models.Model):
    _inherit = 'hr.leave.type'

    work_entry_type_id = fields.Many2one('hr.work.entry.type', string='Work Entry Type')
