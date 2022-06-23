# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models

class HrEmployeeSlidesWizard(models.TransientModel):
    _name = 'hr.employee.slides.wizard'

    employee_id = fields.Many2one('hr.employee')
    partner_id = fields.Many2one()
    line_ids = fields.One2many('hr.employee.slides.line.wizard', 'wizard_id')


class HrEmployeeSlidesLineWizard(models.TransientModel):
    _name = 'hr.employee.slides.line.wizard'

    wizard_id = fields.Many2one('hr.employee.slides.wizard')
    employee_id = fields.Many2one('hr.employee')
    slide_id = fields.Many2one('slide.slide')
    is_registered = fields.Boolean()
    is_completed = fields.Boolean()
    completion = fields.Integer(default=0)

    date_start = fields.Date()
    date_stop = fields.Date()
