# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import Command, fields, models


class HrDepartureWizard(models.TransientModel):
    _inherit = 'hr.departure.wizard'

    unassign_equipment = fields.Boolean("Free Equiments", default=True, help="Unassign Employee from Equipments")

    def action_register_departure(self):
        super().action_register_departure()
        if self.unassign_equipment:
            for employee in self.employee_ids:
                employee.update({'equipment_ids': [Command.unlink(equipment.id) for equipment in employee.equipment_ids]})
