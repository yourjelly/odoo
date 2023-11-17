# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models


class ResourceCalendar(models.Model):
    _inherit = 'resource.calendar'

    contracts_count = fields.Integer("# Contracts using it", compute='_compute_contracts_count', groups="hr_contract.group_hr_contract_manager")

    def _compute_contracts_count(self):
        count_data = self.env['hr.contract']._read_group(
            [('resource_calendar_id', 'in', self.ids)],
            ['resource_calendar_id'],
            ['__count'])
        mapped_counts = {resource_calendar.id: count for resource_calendar, count in count_data}
        for calendar in self:
            calendar.contracts_count = mapped_counts.get(calendar.id, 0)

    def action_open_contracts(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("hr_contract.action_hr_contract")
        action.update({'domain': [('resource_calendar_id', '=', self.id)]})
        return action
