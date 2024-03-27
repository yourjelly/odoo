from odoo import models, fields


class ResourceResourceLeave(models.Model):
    _inherit = 'resource.resource.leave'

    work_entry_type_id = fields.Many2one(
        'hr.work.entry.type', 'Work Entry Type',
        groups="hr.group_hr_user")
