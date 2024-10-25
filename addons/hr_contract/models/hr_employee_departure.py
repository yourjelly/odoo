# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.exceptions import UserError


class HrEmployeeDeparture(models.Model):
    _inherit = ['hr.employee.departure']

    def _get_employee_departure_date(self):
        employee = self.env['hr.employee'].browse(self.env.context['active_id'])
        if employee.contract_id.state == "open":
            return False
        expired_contract = self.env['hr.contract'].search([('employee_id', '=', employee.id), ('state', '=', 'close')], limit=1, order='date_end desc')
        if expired_contract:
            return expired_contract.date_end
        return super()._get_employee_departure_date()

    first_contract_date = fields.Date(related="employee_id.first_contract_date", string="Start Date")
    do_set_date_end = fields.Boolean(
        string="Set Contract End Date",
        default=lambda self: self.env.user.has_group('hr_contract.group_hr_contract_manager'),
        help="Limit contracts date to End of Contract and cancel future ones.")

    def action_register_departure(self):
        """If do_set_date_end is checked, set the departure date as the end date to current running contract,
        and cancel all draft contracts"""
        current_contract = self.sudo().employee_id.contract_id
        if current_contract and current_contract.date_start > self.departure_date:
            raise UserError(_("Departure date can't be earlier than the start date of current contract."))

        super().action_register_departure()
        if self.do_set_date_end:
            self.sudo().employee_id.contract_ids.filtered(lambda c: c.state == 'draft').write({'state': 'cancel'})
            if current_contract and current_contract.state in ['open', 'draft']:
                contract_sudo = self.sudo().employee_id.contract_id
                contract_sudo.write({'date_end': self.departure_date})
                contract_sudo.message_post(body=self.env._('Contract end date has been updated due to the end of the collaboration with %s', self.employee_id.name))
            if current_contract.state == 'open':
                current_contract.state = 'close'
            self.employee_id.message_post(body=self.env._("Contract end date of %s has been set", self.employee_id.name))
