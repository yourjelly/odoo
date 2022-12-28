from odoo import api, fields, models, _
from odoo.exceptions import UserError


class HrPlanActivityType(models.Model):
    _inherit = 'hr.plan.activity.type'
    _description = 'Plan activity type'

    responsible = fields.Selection(selection_add=[('fleet_manager', "Fleet Manager"), ('employee', 'Employee')], ondelete={'fleet_manager': 'set default'})

    def get_responsible_id(self, employee):
        warning =  False
        if self.responsible == 'fleet_manager':
            responsible = self.env['fleet.vehicle'].search([('driver_employee_id', '=', employee._origin.id)], limit=1).manager_id
            # if not responsible:
            #     responsible = self.env['fleet.vehicle'].search([('driver_id', '=', employee.user_id.partner_id.id)])
            if not responsible:
                warning = _('Fleet manager of employee %s is not set.', employee.name)
            return {
                'responsible': responsible,
                'warning': warning,
        }
        return super().get_responsible_id(employee)