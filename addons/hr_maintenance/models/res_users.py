from odoo import api, models, fields
from odoo.addons import hr


class ResUsers(hr.ResUsers):

    equipment_ids = fields.One2many('maintenance.equipment', 'owner_user_id', string="Managed Equipment")
    equipment_count = fields.Integer(related='employee_id.equipment_count', string="Assigned Equipment")

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + ['equipment_count']


class HrEmployee(hr.HrEmployee):

    equipment_ids = fields.One2many('maintenance.equipment', 'employee_id', groups="hr.group_hr_user")
    equipment_count = fields.Integer('Equipment Count', compute='_compute_equipment_count', groups="hr.group_hr_user")

    @api.depends('equipment_ids')
    def _compute_equipment_count(self):
        for employee in self:
            employee.equipment_count = len(employee.equipment_ids)
