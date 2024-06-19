from odoo import models, fields, api, exceptions, _


class HrEmployeeFace(models.Model):
    _name = "hr.employee.face"

    employee_id = fields.Many2one('hr.employee')
    face = fields.Image()

