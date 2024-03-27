from odoo import models, fields


class ResourcePublicLeave(models.Model):
    _inherit = 'resource.public.leave'

    work_entry_type_id = fields.Many2one(
        'hr.work.entry.type', 'Work Entry Type',
        groups="hr.group_hr_user")
